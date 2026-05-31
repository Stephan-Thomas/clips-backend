import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NFT_MINT_QUEUE } from './nft-mint.queue';
import { NftMintService } from './nft-mint.service';

export interface NftMintJob {
  clipId: number;
  walletAddress: string;
  userId: number;
}

@Processor(NFT_MINT_QUEUE)
export class NftMintProcessor extends WorkerHost {
  private readonly logger = new Logger(NftMintProcessor.name);

  constructor(private readonly nftMintService: NftMintService) {
    super();
  }

  async process(job: Job<NftMintJob>): Promise<{ xdr: string; clipId: number }> {
    const { clipId, walletAddress } = job.data;
    this.logger.log(`Processing NFT mint job ${job.id} for clip ${clipId}`);
    const result = await this.nftMintService.prepareMintTx(clipId, walletAddress);
    return { xdr: result.xdr, clipId };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NftMintJob>, error: Error): void {
    this.logger.error(
      `NFT mint job ${job.id} failed for clip ${job.data.clipId}: ${error.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NftMintJob>): void {
    this.logger.log(`NFT mint job ${job.id} completed for clip ${job.data.clipId}`);
  }
}
