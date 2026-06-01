import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailService } from './mail.service';
import { MetricsService } from '../metrics/metrics.service';
import {
  EMAIL_DELIVERY_QUEUE,
  EmailDeliveryJobData,
} from './email-delivery.queue';

@Processor(EMAIL_DELIVERY_QUEUE)
export class EmailDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailDeliveryProcessor.name);

  constructor(
    private readonly mailService: MailService,
    private readonly metricsService: MetricsService,
  ) {
    super();
  }

  async process(job: Job<EmailDeliveryJobData>): Promise<void> {
    this.logger.log(
      `Processing email job ${job.id} — attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1} ` +
        `to=${job.data.to} template=${job.data.template}`,
    );

    const jobMetricId = `${EMAIL_DELIVERY_QUEUE}:${job.id}`;
    this.metricsService.recordJobStart(jobMetricId);

    try {
      await this.mailService.sendTemplatedEmail(job.data);
      this.metricsService.recordJobCompletion(jobMetricId, EMAIL_DELIVERY_QUEUE, 'success');
    } catch (error) {
      this.metricsService.recordJobCompletion(jobMetricId, EMAIL_DELIVERY_QUEUE, 'failure');
      this.metricsService.recordJobFailure(EMAIL_DELIVERY_QUEUE, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailDeliveryJobData>, error: Error): void {
    const maxAttempts = job.opts.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade >= maxAttempts;

    if (!isFinalAttempt) {
      // Intermediate failure — compute the next backoff delay for the log message
      const backoffDelay = job.opts.backoff
        ? typeof job.opts.backoff === 'number'
          ? job.opts.backoff
          : // exponential: delay * 2^(attemptsMade - 1)
            (job.opts.backoff.delay ?? 500) *
            Math.pow(2, job.attemptsMade - 1)
        : 0;

      this.logger.warn(
        `[RETRY] Email job ${job.id} failed on attempt ${job.attemptsMade}/${maxAttempts} — ` +
          `to=${job.data.to} template=${job.data.template} — ` +
          `reason: ${error.message} — ` +
          `retrying in ~${Math.round(backoffDelay / 1000)}s`,
      );
      return;
    }

    this.logger.error(
      `[FINAL FAILURE] Email job ${job.id} moved to DLQ after ${maxAttempts} attempts — ` +
        `to=${job.data.to} template=${job.data.template} — ` +
        `reason: ${error.message}`,
      error.stack,
    );
    this.metricsService.recordJobFailure(EMAIL_DELIVERY_QUEUE, 'final_failure');
  }
}
