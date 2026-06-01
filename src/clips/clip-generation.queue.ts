/** BullMQ queue name for clip-generation jobs */
export const CLIP_GENERATION_QUEUE = 'clip-generation';

/**
 * Clip generation jobs are CPU and memory intensive, so they are scheduled
 * at normal priority relative to lightweight background work.
 */
export const CLIP_GENERATION_QUEUE_PRIORITY = 5;

/**
 * Default job options applied to every clip-generation job.
 *
 * Retry strategy (transient failures: network, FFmpeg OOM, Cloudinary rate-limits):
 *   - 5 attempts total (1 initial + 4 automatic retries)
 *   - Exponential backoff starting at 2 000 ms
 *     attempt 1 → immediate
 *     attempt 2 → ~2 000 ms delay
 *     attempt 3 → ~4 000 ms delay
 *     attempt 4 → ~8 000 ms delay
 *     attempt 5 → ~16 000 ms delay
 *   - After all attempts are exhausted BullMQ moves the job to the
 *     failed set, which triggers the @OnWorkerEvent('failed') handler.
 */
export const CLIP_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    /** Base delay in ms — doubles on every retry */
    delay: 2000,
  },
  priority: CLIP_GENERATION_QUEUE_PRIORITY,
} as const;
