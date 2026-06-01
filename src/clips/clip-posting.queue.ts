/** BullMQ queue name for social-media posting jobs */
export const CLIP_POSTING_QUEUE = 'clip-posting';

/**
 * Posting jobs are I/O bound and lower priority than clip generation.
 */
export const CLIP_POSTING_QUEUE_PRIORITY = 10;

/**
 * Job data shape for a posting job.
 */
export interface ClipPostingJob {
  clipId: number;
  userId: number;
  mediaUrl: string;
  caption: string;
  platforms: string[];
}

/**
 * Default job options for the clip-posting queue.
 *
 * Posting jobs are lightweight (HTTP API calls) and therefore get:
 *  - More attempts than heavy processing jobs (5 vs 3) to handle API rate limits
 *  - Exponential backoff starting at 2 000 ms to respect social-platform rate limits
 *    attempt 2 → ~2 000 ms
 *    attempt 3 → ~4 000 ms
 *    attempt 4 → ~8 000 ms
 *    attempt 5 → ~16 000 ms
 *
 * Worker concurrency (set in ClipsModule) is intentionally higher than the
 * video-processing worker because posting jobs are I/O-bound and non-CPU-intensive.
 */
export const CLIP_POSTING_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  priority: CLIP_POSTING_QUEUE_PRIORITY,
} as const;
