import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailService } from './mail.service';
import {
  EMAIL_DELIVERY_QUEUE,
  EmailDeliveryJobData,
} from './email-delivery.queue';

@Processor(EMAIL_DELIVERY_QUEUE)
export class EmailDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailDeliveryProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
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
