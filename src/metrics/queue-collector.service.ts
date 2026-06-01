import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { QueueMetricsService } from './queue-metrics.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Optional } from '@nestjs/common';

/**
 * QueueCollectorService periodically collects metrics from all BullMQ queues.
 *
 * This service:
 *   - Discovers all registered queues via dependency injection
 *   - Polls queue stats every 30 seconds
 *   - Records metrics via QueueMetricsService
 *   - Handles queue unavailability gracefully
 */
@Injectable()
export class QueueCollectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueCollectorService.name);
  private readonly registeredQueues: Map<string, Queue> = new Map();

  constructor(
    private readonly queueMetrics: QueueMetricsService,
    @Optional()
    @Inject(getQueueToken('clip-generation'))
    private readonly clipGenerationQueue?: Queue,
    @Optional()
    @Inject(getQueueToken('nft-mint'))
    private readonly nftMintQueue?: Queue,
    @Optional()
    @Inject(getQueueToken('email-delivery'))
    private readonly emailDeliveryQueue?: Queue,
    @Optional()
    @Inject(getQueueToken('clip-posting'))
    private readonly clipPostingQueue?: Queue,
    @Optional()
    @Inject(getQueueToken('anomaly-detection'))
    private readonly anomalyDetectionQueue?: Queue,
  ) {
    // Register all available queues
    if (clipGenerationQueue) {
      this.registeredQueues.set('clip-generation', clipGenerationQueue);
    }
    if (nftMintQueue) {
      this.registeredQueues.set('nft-mint', nftMintQueue);
    }
    if (emailDeliveryQueue) {
      this.registeredQueues.set('email-delivery', emailDeliveryQueue);
    }
    if (clipPostingQueue) {
      this.registeredQueues.set('clip-posting', clipPostingQueue);
    }
    if (anomalyDetectionQueue) {
      this.registeredQueues.set('anomaly-detection', anomalyDetectionQueue);
    }
  }

  onModuleInit(): void {
    this.logger.log(`Registered ${this.registeredQueues.size} queues for metrics collection`);
    for (const queueName of this.registeredQueues.keys()) {
      this.logger.debug(`Queue registered: ${queueName}`);
    }
    // Run initial collection immediately
    this.collectMetrics().catch((err) =>
      this.logger.error(`Failed to collect initial metrics: ${err.message}`),
    );
  }

  onModuleDestroy(): void {
    this.logger.log('QueueCollectorService destroyed');
  }

  /**
   * Periodically collect metrics from all registered queues.
   * Runs every 30 seconds.
   */
  @Interval(30000)
  async collectMetrics(): Promise<void> {
    try {
      for (const [queueName, queue] of this.registeredQueues) {
        try {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
            'prioritized',
          );

          this.queueMetrics.recordQueueCounts(queueName, counts);

          // Calculate average retry count
          const failedJobs = await queue.getFailed(0, 100);
          const avgRetries =
            failedJobs.length > 0
              ? failedJobs.reduce((sum, job) => sum + (job.attemptsMade || 0), 0) /
                failedJobs.length
              : 0;
          this.queueMetrics.recordAvgRetryCount(queueName, avgRetries);

          this.logger.debug(
            `Queue metrics [${queueName}]: waiting=${counts.waiting}, active=${counts.active}, ` +
              `completed=${counts.completed}, failed=${counts.failed}, avg_retries=${avgRetries.toFixed(2)}`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to collect metrics for queue ${queueName}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Critical error in metrics collection: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Get registered queue names for introspection.
   */
  getRegisteredQueues(): string[] {
    return Array.from(this.registeredQueues.keys());
  }
}
