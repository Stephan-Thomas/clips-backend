import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { MailService } from './mail.service';
import {
  EMAIL_DELIVERY_QUEUE,
  EmailDeliveryJobData,
} from './email-delivery.queue';
import { getBullMQWorkerConfig } from '../config/bullmq.config';

/**
 * BullMQ processor for email delivery jobs.
 *
 * Worker concurrency is controlled by BULLMQ_EMAIL_DELIVERY_CONCURRENCY env var.
 * Default: 5 concurrent jobs (email sending is I/O-bound and can handle more parallelism)
 */
@Processor(EMAIL_DELIVERY_QUEUE, {
  concurrency: getBullMQWorkerConfig(new ConfigService()).emailDeliveryConcurrency,
})
export class EmailDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailDeliveryProcessor.name);

  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    super();
    const config = getBullMQWorkerConfig(configService);
    this.logger.log(
      `Email delivery worker initialized with concurrency: ${config.emailDeliveryConcurrency}`,
    );
  }

  async process(job: Job<EmailDeliveryJobData>): Promise<void> {
    await this.mailService.sendTemplatedEmail(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailDeliveryJobData>, error: Error): void {
    const attempts = job.opts.attempts ?? 1;
    const isTerminalFailure = job.attemptsMade >= attempts;
    if (!isTerminalFailure) {
      return;
    }

    this.logger.error(
      `Email job moved to DLQ after ${attempts} attempts for ${job.data.to}: ${error.message}`,
    );
  }
}
