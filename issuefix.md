# Issue Fix Plan: clips-backend

## Issue 1: Health Check for Queues

**Current state:**
- No health check endpoint exists. `AppController` only has `GET /` returning "Hello World!".
- BullMQ is configured in `app.module.ts` via `BullModule.forRoot()` with a Redis connection.
- The `clip-generation` queue is registered in `clips.module.ts` and `jobs.module.ts`.
- `RedisService` exists with a `ping()` method.
- `ClipsService.refreshQueueDepth()` already calls `clipQueue.getJobCounts()`.

**Implementation plan:**
1. Create `src/health/health.module.ts`, `src/health/health.service.ts`, and `src/health/health.controller.ts`.
2. `HealthService` will:
   - Ping Redis via `RedisService.getClient()`.
   - Call `getJobCounts('active', 'waiting', 'failed')` on the `clip-generation` queue obtained from `BullModule.registerQueue` or by injecting the queue.
   - Return status for each queue with active/waiting/failed counts.
3. `HealthController` will expose:
   - `GET /health` — overall health (Redis + queue status).
   - `GET /health/queues` — detailed per-queue status.
4. Register `HealthModule` in `AppModule`.
5. Integrate `/health` into the main health check flow (the root `/health` endpoint aggregates Redis + queue results).

---

## Issue 2: Notify User on Video Processing Completion

**Current state:**
- `ClipGenerationProcessor` has `@OnWorkerEvent('completed')` and `@OnWorkerEvent('failed')` handlers.
- On completion, `onCompleted()` updates the clip in Prisma and emits WebSocket progress.
- On failure, `CLIP_GENERATION_FAILED_EVENT` is emitted, handled by `ClipsService.handleClipGenerationFailed()` which updates Video status to `failed`.
- `MailService` exists with templated email methods but nothing for clip completion.
- `EmailDeliveryService` exists to enqueue emails via BullMQ.
- No notification on success currently exists.

**Implementation plan:**
1. Create a new event `CLIP_GENERATION_COMPLETED_EVENT` in `src/clips/clips.events.ts` with payload `{ videoId, clipId, clipUrl, userId }`.
2. Emit `CLIP_GENERATION_COMPLETED_EVENT` in `ClipGenerationProcessor.onCompleted()` after the DB update succeeds.
3. Create `src/notifications/notifications.service.ts` and `src/notifications/notifications.module.ts`:
   - Listen for `CLIP_GENERATION_COMPLETED_EVENT` via `@OnEvent()`.
   - Fetch the user's email from Prisma using `video.userId`.
   - Fetch the video title.
   - Send in-app notification via `ClipsGateway` to the user's room (`user:${userId}`).
   - Send email via `EmailDeliveryService.enqueue()` with a "clip-ready" template containing the clips preview link.
4. Add the preview link to the email: `${process.env.APP_BASE_URL}/videos/${videoId}`.
5. Register `NotificationsModule` in `AppModule`.

---

## Issue 3: Redis Data Persistence (RDB + AOF)

**Current state:**
- Redis is configured in `app.module.ts` via `BullModule.forRoot()` with connection host/port.
- `RedisService` connects using `ioredis` but no persistence config is present.
- No `docker-compose.yml` exists — Redis runs externally or via a separate setup.
- `.env.example` contains Redis host/port/password but no persistence settings.

**Implementation plan:**
1. Update `app.module.ts` `BullModule.forRoot()` to include explicit `maxRetriesPerRequest` and keep the connection config.
2. Update `RedisService` constructor to accept optional persistence-related options if needed (e.g., lazyConnect stays true).
3. Create a `docker-compose.yml` with a Redis service:
   - Image: `redis:7-alpine`
   - Volumes: `redis_data:/data`
   - Command: `redis-server --appendonly yes --save 60 1 --save 300 10`
   - This enables AOF (`appendonly yes`) and RDB snapshots (save at 60s/1 key and 300s/10 keys).
4. Document the recovery process in a new `docs/redis-recovery.md`:
   - Steps to restore from AOF/RDB.
   - How to verify data integrity.
   - How to handle failed persistence checks.
5. Update `.env.example` with persistence-related comments if needed.

---

## Issue 4: Dead Letter Queue for Failed Jobs

**Current state:**
- `clip-generation.queue.ts` defines `CLIP_JOB_OPTIONS` with `attempts: 3` and exponential backoff.
- After all retries, BullMQ moves jobs to the failed set automatically.
- `jobs.controller.ts` has `GET /jobs/failed` and `POST /jobs/retry/:jobId`.
- `jobs.service.ts` implements `getFailedJobs()` and `retryJob()` using `clipQueue.getFailed()`.
- No explicit dead letter queue configuration exists (no `removeOnFail: false` on the job options, no separate DLQ queue).
- BullMQ natively keeps failed jobs in the failed set, but there is no dedicated DLQ queue for manual review.

**Implementation plan:**
1. In `clip-generation.queue.ts`, add a dead letter queue constant: `DEAD_LETTER_QUEUE = 'clip-generation-dlq'`.
2. Update `CLIP_JOB_OPTIONS` to include `removeOnFail: false` so failed jobs are retained for manual review.
3. In `jobs.module.ts`, register the DLQ via `BullModule.registerQueue({ name: DEAD_LETTER_QUEUE })`.
4. In `ClipGenerationProcessor.onFailed()`, after handling the final failure, move the failed job to the DLQ:
   - Retrieve the failed job from the main queue.
   - Add it to the DLQ with the same data + `failedReason`, `attemptsMade`, `finishedOn`.
   - Optionally remove it from the main queue's failed set to avoid duplication.
5. In `JobsService`, add:
   - `getDeadLetterJobs()` — reads from the DLQ and returns job details.
   - `retryDeadLetterJob(jobId)` — moves a job from DLQ back to the main queue for re-processing.
6. In `JobsController`, add:
   - `GET /jobs/dead-letter` — list dead letter jobs.
   - `POST /jobs/dead-letter/retry/:jobId` — retry a dead letter job.
