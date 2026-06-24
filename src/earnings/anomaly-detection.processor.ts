import { Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { MetricsService } from '../metrics/metrics.service';
import { ANOMALY_DETECTION_QUEUE } from './anomaly-detection.queue';
import { MailService } from '../auth/mail.service';
import { GracefulShutdownService } from '../common/shutdown/graceful-shutdown.service';

interface AnomalyDetectionJob {
  earningId: number;
}

/**
 * BullMQ processor for anomaly-detection jobs.
 *
 * Migrated from legacy @Process() (Bull v3) to WorkerHost (BullMQ) so that:
 *  - The worker participates in the NestJS shutdown lifecycle.
 *  - GracefulShutdownService can drain in-flight jobs before the process exits.
 *  - @OnWorkerEvent handlers are available for structured failure logging.
 */
@Processor(ANOMALY_DETECTION_QUEUE)
export class AnomalyDetectionProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(AnomalyDetectionProcessor.name);

  constructor(
    private readonly anomalyDetectionService: AnomalyDetectionService,
    private readonly mailService: MailService,
    private readonly metricsService: MetricsService,
    private readonly shutdownService: GracefulShutdownService,
  ) {
    super();
  }

  onModuleInit(): void {
    this.shutdownService.register(this.worker);
  }

  async process(job: Job<AnomalyDetectionJob>): Promise<void> {
    const { earningId } = job.data;
    this.logger.log(`Processing anomaly detection for earning ${earningId}`);

    const jobMetricId = `${ANOMALY_DETECTION_QUEUE}:${job.id}`;
    this.metricsService.recordJobStart(jobMetricId);

    try {
      const result = await this.anomalyDetectionService.detectAnomalies(earningId);

      if (result.isAnomaly && result.severity === 'high') {
        await this.notifyAdmins(result);
      }

      this.metricsService.recordJobCompletion(jobMetricId, ANOMALY_DETECTION_QUEUE, 'success');
    } catch (error) {
      this.logger.error(`Anomaly detection failed for earning ${earningId}:`, error);
      this.metricsService.recordJobCompletion(jobMetricId, ANOMALY_DETECTION_QUEUE, 'failure');
      this.metricsService.recordJobFailure(
        ANOMALY_DETECTION_QUEUE,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AnomalyDetectionJob>, error: Error): void {
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isFinalAttempt) {
      this.logger.error(
        `[FINAL FAILURE] Anomaly detection job ${job.id} exhausted all attempts — ` +
          `earningId=${job.data.earningId} reason: ${error.message}`,
      );
      this.metricsService.recordJobFailure(ANOMALY_DETECTION_QUEUE, 'final_failure');
    } else {
      this.logger.warn(
        `[RETRY] Anomaly detection job ${job.id} will retry — ` +
          `attempt ${job.attemptsMade}/${job.opts.attempts ?? 1} reason: ${error.message}`,
      );
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AnomalyDetectionJob>): void {
    this.logger.log(
      `Anomaly detection job ${job.id} completed for earning ${job.data.earningId}`,
    );
  }

  private async notifyAdmins(result: { reason: string; severity: string }): Promise<void> {
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') ?? [];

    if (adminEmails.length === 0) {
      this.logger.warn('No admin emails configured for anomaly notifications');
      return;
    }

    const subject = `[${result.severity.toUpperCase()}] Earnings Anomaly Detected`;
    const text =
      `A ${result.severity} severity earnings anomaly has been detected:\n\n` +
      `${result.reason}\n\nPlease review the anomaly alerts in the admin dashboard.`;

    for (const email of adminEmails) {
      try {
        await this.mailService.sendMail({ to: email.trim(), subject, text });
        this.logger.log(`Anomaly notification sent to ${email}`);
      } catch (error) {
        this.logger.error(`Failed to send anomaly notification to ${email}:`, error);
      }
    }
  }
}
