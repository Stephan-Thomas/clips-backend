import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { CLIP_GENERATION_QUEUE } from '../clips/clip-generation.queue';
import { CLIP_POSTING_QUEUE } from '../clips/clip-posting.queue';
import { PAYOUT_RETRY_QUEUE } from '../payouts/payout-retry.queue';

@Injectable()
export class QueueDashboardService {
  private serverAdapter: ExpressAdapter;

  constructor(
    @InjectQueue(CLIP_GENERATION_QUEUE)
    private clipGenerationQueue: Queue,
    @InjectQueue(CLIP_POSTING_QUEUE)
    private clipPostingQueue: Queue,
    @InjectQueue(PAYOUT_RETRY_QUEUE)
    private payoutRetryQueue: Queue,
  ) {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [
        new BullMQAdapter(this.clipGenerationQueue),
        new BullMQAdapter(this.clipPostingQueue),
        new BullMQAdapter(this.payoutRetryQueue),
      ],
      serverAdapter: this.serverAdapter,
    });
  }

  getRouter() {
    return this.serverAdapter.getRouter();
  }
}
