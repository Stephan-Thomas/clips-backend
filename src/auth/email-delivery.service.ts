import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  EMAIL_DELIVERY_JOB,
  EMAIL_DELIVERY_QUEUE,
  EMAIL_JOB_OPTIONS,
  EmailDeliveryJobData,
} from './email-delivery.queue';

@Injectable()
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name);

  constructor(
    @InjectQueue(EMAIL_DELIVERY_QUEUE)
    private readonly queue: Queue<EmailDeliveryJobData>,
  ) {}

  async enqueue(data: EmailDeliveryJobData): Promise<void> {
    await this.queue.add(EMAIL_DELIVERY_JOB, data, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued email delivery for ${data.to} (${data.template})`);
  }
}
