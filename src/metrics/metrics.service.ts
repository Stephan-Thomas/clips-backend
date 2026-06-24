import { Injectable, Logger } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Summary,
  register,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * MetricsService
 *
 * Central place for all Prometheus metrics in the application.
 *
 * Tracks:
 *  - HTTP request throughput and processing latency (via MetricsInterceptor)
 *  - Queue job throughput: jobs started, completed (success/failure), failed
 *  - Per-job processing duration (histogram + summary for percentiles)
 *  - Queue depth gauge (waiting + active + delayed jobs)
 *  - Domain counters: clips generated, NFT mints, Stellar RPC errors,
 *    Cloudinary upload errors
 *
 * All metrics are exposed on GET /metrics (see MetricsController).
 * The endpoint is protected by the METRICS_TOKEN bearer token.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  // ── In-flight job start times (for duration tracking) ────────────────────
  // Keyed by jobMetricId (`${queueName}:${jobId}`)
  private readonly jobStartTimes = new Map<string, number>();

  // ── HTTP metrics ────────────────────────────────────────────────────────────

  /** Total HTTP requests served, labelled by method, route, and status code. */
  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'] as const,
  });

  /**
   * HTTP request duration histogram (seconds).
   * Buckets are tuned for an API that mixes fast reads (< 100 ms) and
   * slower job-enqueue operations (up to a few seconds).
   */
  readonly httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  // ── Queue throughput ─────────────────────────────────────────────────────────

  /** Total jobs started across all queues. */
  readonly jobsStartedTotal = new Counter({
    name: 'queue_jobs_started_total',
    help: 'Total number of queue jobs started',
    labelNames: ['queue'] as const,
  });

  /** Total jobs completed (success or failure), labelled by queue and outcome. */
  readonly jobsCompletedTotal = new Counter({
    name: 'queue_jobs_completed_total',
    help: 'Total number of queue jobs completed',
    labelNames: ['queue', 'status'] as const,
  });

  /**
   * Total jobs that reached their final failure state (all retries exhausted),
   * labelled by queue and failure reason.
   */
  readonly jobsFailedTotal = new Counter({
    name: 'queue_jobs_failed_total',
    help: 'Total number of queue jobs that permanently failed',
    labelNames: ['queue', 'reason'] as const,
  });

  // ── Queue processing speed ───────────────────────────────────────────────────

  /**
   * Job processing duration histogram (seconds) per queue.
   * Buckets span from 100 ms (fast email) up to 10 minutes (slow FFmpeg + upload).
   */
  readonly jobDurationSeconds = new Histogram({
    name: 'queue_job_duration_seconds',
    help: 'Time taken to process a single queue job, in seconds',
    labelNames: ['queue', 'status'] as const,
    buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300, 600],
  });

  /**
   * Summary of job processing durations per queue.
   * Provides P50/P90/P99 percentiles with a 5-minute sliding window.
   */
  readonly jobDurationSummary = new Summary({
    name: 'queue_job_duration_summary_seconds',
    help: 'Summary of queue job processing durations (percentiles)',
    labelNames: ['queue'] as const,
    percentiles: [0.5, 0.9, 0.95, 0.99],
    maxAgeSeconds: 300,
    ageBuckets: 5,
  });

  // ── Queue depth ──────────────────────────────────────────────────────────────

  /**
   * Current queue depth (waiting + active + delayed jobs) per queue.
   * Updated every time a job is enqueued or a job completes.
   */
  readonly queueDepthGauge = new Gauge({
    name: 'queue_depth',
    help: 'Current number of jobs waiting, active, or delayed in the queue',
    labelNames: ['queue'] as const,
  });

  // ── Domain counters ──────────────────────────────────────────────────────────

  /** Total clips generated, labelled by outcome (success | failure). */
  readonly clipsGeneratedTotal = new Counter({
    name: 'clips_generated_total',
    help: 'Total clips generated',
    labelNames: ['status'] as const,
  });

  /** Total NFT mints attempted, labelled by outcome. */
  readonly nftMintsTotal = new Counter({
    name: 'nft_mints_total',
    help: 'Total NFT mint attempts',
    labelNames: ['status'] as const,
  });

  /** Total Stellar RPC errors encountered. */
  readonly stellarRpcErrorsTotal = new Counter({
    name: 'stellar_rpc_errors_total',
    help: 'Total Stellar RPC errors',
    labelNames: [] as const,
  });

  /** Total Cloudinary upload errors encountered. */
  readonly cloudinaryUploadErrorsTotal = new Counter({
    name: 'cloudinary_upload_errors_total',
    help: 'Total Cloudinary upload errors',
    labelNames: [] as const,
  });

  constructor() {
    // Collect Node.js default metrics: heap, event-loop lag, GC, CPU, etc.
    collectDefaultMetrics({ register });
    this.logger.log('MetricsService initialised — default metrics collection started');
  }

  // ── HTTP helpers ─────────────────────────────────────────────────────────────

  /**
   * Record HTTP request duration and increment the total counter.
   * Called by MetricsInterceptor after every request.
   */
  observeHttpDuration(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
    this.httpRequestsTotal.inc(labels);
  }

  // ── Queue job lifecycle ───────────────────────────────────────────────────────

  /**
   * Call at the very beginning of a job's `process()` method.
   * Records the wall-clock start time so we can compute duration on completion.
   */
  recordJobStart(jobMetricId: string): void {
    this.jobStartTimes.set(jobMetricId, Date.now());

    // Extract queue name from the metric ID format `${queue}:${jobId}`
    const queue = this.queueFromMetricId(jobMetricId);
    this.jobsStartedTotal.inc({ queue });
  }

  /**
   * Call when a job finishes (success or failure).
   * Calculates and records the processing duration, then increments the
   * completed counter.
   *
   * @param jobMetricId  Same ID passed to recordJobStart
   * @param queueName    Queue name for labelling
   * @param status       'success' | 'failure'
   */
  recordJobCompletion(
    jobMetricId: string,
    queueName: string,
    status: 'success' | 'failure',
  ): void {
    const startTime = this.jobStartTimes.get(jobMetricId);
    if (startTime !== undefined) {
      const durationMs = Date.now() - startTime;
      const durationSecs = durationMs / 1000;

      this.jobDurationSeconds.observe({ queue: queueName, status }, durationSecs);
      this.jobDurationSummary.observe({ queue: queueName }, durationSecs);
      this.jobStartTimes.delete(jobMetricId);
    }

    this.jobsCompletedTotal.inc({ queue: queueName, status });
  }

  /**
   * Call when a job permanently fails (all retries exhausted, or
   * intermediate errors worth counting separately).
   */
  recordJobFailure(queueName: string, reason: string): void {
    // Normalise noisy reasons to prevent high-cardinality label explosion
    const normalisedReason = this.normaliseFailureReason(reason);
    this.jobsFailedTotal.inc({ queue: queueName, reason: normalisedReason });
  }

  // ── Queue depth ───────────────────────────────────────────────────────────────

  /** Update the current queue depth gauge. Called after every enqueue/dequeue. */
  setQueueDepth(queue: string, depth: number): void {
    this.queueDepthGauge.set({ queue }, depth);
  }

  // ── Domain counters ───────────────────────────────────────────────────────────

  incrementClipsGenerated(status: 'success' | 'failure'): void {
    this.clipsGeneratedTotal.inc({ status });
  }

  incrementNftMints(status: 'success' | 'failure'): void {
    this.nftMintsTotal.inc({ status });
  }

  incrementStellarRpcErrors(): void {
    this.stellarRpcErrorsTotal.inc();
  }

  incrementCloudinaryUploadErrors(): void {
    this.cloudinaryUploadErrorsTotal.inc();
  }

  // ── Registry accessor ─────────────────────────────────────────────────────────

  /** Returns the Prometheus registry, used by MetricsController to render /metrics. */
  getRegistry() {
    return register;
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  /** Extract the queue name from a metric ID like `clip-generation:abc123`. */
  private queueFromMetricId(metricId: string): string {
    const colonIdx = metricId.lastIndexOf(':');
    return colonIdx >= 0 ? metricId.slice(0, colonIdx) : metricId;
  }

  /**
   * Collapse high-cardinality failure reasons (stack traces, dynamic messages)
   * into a small fixed set of labels so Prometheus cardinality stays bounded.
   */
  private normaliseFailureReason(reason: string): string {
    if (reason === 'final_failure') return 'final_failure';
    if (reason.toLowerCase().includes('timeout')) return 'timeout';
    if (reason.toLowerCase().includes('cancel')) return 'cancelled';
    if (reason.toLowerCase().includes('network') || reason.toLowerCase().includes('econnrefused')) {
      return 'network_error';
    }
    if (reason.toLowerCase().includes('memory') || reason.toLowerCase().includes('oom')) {
      return 'oom';
    }
    if (reason.toLowerCase().includes('cloudinary') || reason.toLowerCase().includes('upload')) {
      return 'upload_error';
    }
    return 'other';
  }
}
