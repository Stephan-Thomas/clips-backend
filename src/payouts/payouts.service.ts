import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { PayoutReceiptService } from './payout-receipt.service';
import { FeeService } from './fee.service';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly defaultPayoutCurrency =
    process.env.DEFAULT_PAYOUT_CURRENCY ?? 'USD';

  constructor(
    private prisma: PrismaService,
    private stellarService: StellarService,
    private payoutReceiptService: PayoutReceiptService,
    private feeService: FeeService,
  ) {
    this.minPayoutAmount = parseFloat(process.env.MIN_STELLAR_PAYOUT ?? '5');
  }

  async requestPayout(userId: number): Promise<{
    id: number;
    amount: number;
    status: string;
    createdAt: Date;
    feeAmount?: number;
    finalAmount?: number;
  }> {
    // Check for existing pending payout
    const existingPending = await this.prisma.payout.findFirst({
      where: { userId, status: 'pending' },
    });

    if (existingPending) {
      throw new ConflictException(
        'A payout request is already pending for this user',
      );
    }

    // Get user's wallet
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, deletedAt: null },
    });

    if (!wallet) {
      throw new BadRequestException(
        'No active Stellar wallet found. Please connect a wallet first.',
      );
    }

    // Calculate user's pending balance from earnings
    const totalEarnings = await this.prisma.earning.aggregate({
      where: { clip: { video: { userId } }, deletedAt: null },
      _sum: { amount: true },
    });

    const totalPaidOut = await this.prisma.payout.aggregate({
      where: { userId, status: { in: ['completed', 'processing'] } },
      _sum: { amount: true },
    });

    const pendingBalance =
      (totalEarnings._sum.amount ?? 0) - (totalPaidOut._sum.amount ?? 0);

    const currency = this.defaultPayoutCurrency;
    const payoutAmount = this.payoutLimitsService.resolvePayoutAmount(
      availableBalance,
      currency,
    );

    // Calculate fees
    const feeCalculation = await this.feeService.calculateFee(
      pendingBalance,
      'stellar',
    );

    // Create payout record with fee information
    const payout = await this.prisma.payout.create({
      data: {
        userId,
        walletId: wallet.id,
        amount: payoutAmount,
        currency,
        method: 'stellar',
        status: 'pending',
        feeAmount: feeCalculation.feeAmount,
        feePercentage: feeCalculation.feePercentage,
        finalAmount: feeCalculation.finalAmount,
      },
    });

    return {
      id: payout.id,
      amount: payout.amount,
      status: payout.status,
      createdAt: payout.createdAt,
      feeAmount: payout.feeAmount,
      finalAmount: payout.finalAmount,
    };
  }

  async getPayouts(
    userId: number,
    status?: string,
  ): Promise<PayoutListItem[]> {
    const filterStatus = this.parseStatusFilter(status);

    return this.prisma.payout.findMany({
      where: {
        userId,
        ...(filterStatus ? { status: filterStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: payoutListSelect,
    });
  }

  async getPayoutById(
    userId: number,
    payoutId: number,
  ): Promise<PayoutDetail> {
    const payout = await this.prisma.payout.findFirst({
      where: { id: payoutId, userId },
      select: payoutDetailSelect,
    });

    if (!payout) {
      throw new NotFoundException('Payout record not found');
    }

    return payout;
  }

  private parseStatusFilter(status?: string): PayoutFilterStatus | undefined {
    if (!status) {
      return undefined;
    }

    if (
      !PAYOUT_FILTER_STATUSES.includes(status as PayoutFilterStatus)
    ) {
      throw new BadRequestException(
        `status must be one of: ${PAYOUT_FILTER_STATUSES.join(', ')}`,
      );
    }

    return status as PayoutFilterStatus;
  }

  async processPayout(payoutId: number): Promise<{
    id: number;
    status: string;
    transactionId: string;
    onChainTxHash: string | null;
  }> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: { wallet: true, user: true },
    });

    if (!payout) {
      throw new NotFoundException('Payout record not found');
    }

    if (payout.status !== 'pending') {
      throw new BadRequestException(
        `Payout is already in ${payout.status} status`,
      );
    }

    if (!payout.wallet) {
      throw new BadRequestException('No wallet associated with this payout');
    }

    const platformSecret = process.env.STELLAR_PLATFORM_SECRET;
    if (!platformSecret) {
      throw new InternalServerErrorException(
        'STELLAR_PLATFORM_SECRET environment variable is not set',
      );
    }

    const sourceKeyPair = StellarSdk.Keypair.fromSecret(platformSecret);
    const server = new StellarSdk.Horizon.Server(
      this.stellarService.horizonUrl,
    );

    try {
      const sourceAccount = await server.loadAccount(sourceKeyPair.publicKey());

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.stellarService.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: payout.wallet.address,
            asset: StellarSdk.Asset.native(),
            amount: payout.amount.toString(),
          }),
        )
        .setTimeout(60)
        .build();

      transaction.sign(sourceKeyPair);

      const submitResult = await server.submitTransaction(transaction);

      await this.prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: 'completed',
          transactionId: transaction.hash().toString('hex'),
          onChainTxHash: submitResult.hash,
          confirmedAt: new Date(),
        },
      });

      this.logger.log(
        `Payout ${payoutId} completed. Transaction hash: ${submitResult.hash}`,
      );

      void this.payoutReceiptService.generateAndSendReceipt({
        payoutId: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        method: payout.method,
        transactionId: transaction.hash().toString('hex'),
        onChainTxHash: submitResult.hash,
        confirmedAt: new Date(),
        recipientEmail: payout.user.email,
        walletAddress: payout.wallet.address,
      });

      return {
        id: payout.id,
        status: 'completed',
        transactionId: transaction.hash().toString('hex'),
        onChainTxHash: submitResult.hash,
      };
    } catch (error) {
      this.logger.error(`Stellar payout failed for ${payoutId}:`, error);

      await this.prisma.payout.update({
        where: { id: payoutId },
        data: { status: 'failed' },
      });

      throw new InternalServerErrorException(
        'Failed to process Stellar payout',
      );
    }
  }

  async approvePayout(payoutId: number): Promise<{ id: number; status: string; approvedAt: Date }> {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== 'pending') {
      throw new BadRequestException(`Cannot approve payout in '${payout.status}' status`);
    }

    const updated = await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'approved', approvedAt: new Date() },
    });

    this.logger.log(`Payout ${payoutId} approved by admin`);
    return { id: updated.id, status: updated.status, approvedAt: updated.approvedAt! };
  }

  async rejectPayout(
    payoutId: number,
    reason?: string,
  ): Promise<{ id: number; status: string; rejectedAt: Date; rejectionReason: string | null }> {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (!['pending', 'approved'].includes(payout.status)) {
      throw new BadRequestException(`Cannot reject payout in '${payout.status}' status`);
    }

    const updated = await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'rejected', rejectedAt: new Date(), rejectionReason: reason ?? null },
    });

    this.logger.log(`Payout ${payoutId} rejected by admin. Reason: ${reason ?? 'none'}`);
    return {
      id: updated.id,
      status: updated.status,
      rejectedAt: updated.rejectedAt!,
      rejectionReason: updated.rejectionReason,
    };
  }

  async listPendingPayouts(): Promise<Array<{ id: number; userId: number; amount: number; currency: string; status: string; createdAt: Date }>> {
    return this.prisma.payout.findMany({
      where: { status: { in: ['pending', 'approved'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true, amount: true, currency: true, status: true, createdAt: true },
    });
  async batchProcessPayouts(payoutIds: number[]): Promise<{
    processed: number;
    failed: number;
    results: Array<{ id: number; status: string; error?: string }>;
  }> {
    const results: Array<{ id: number; status: string; error?: string }> = [];
    let processed = 0;
    let failed = 0;

    for (const payoutId of payoutIds) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const payout = await tx.payout.findUnique({
            where: { id: payoutId },
            include: { wallet: true, user: true },
          });

          if (!payout) {
            throw new NotFoundException('Payout record not found');
          }

          if (payout.status !== 'pending') {
            throw new BadRequestException(
              `Payout is already in ${payout.status} status`,
            );
          }

          if (!payout.wallet) {
            throw new BadRequestException(
              'No wallet associated with this payout',
            );
          }

          const platformSecret = process.env.STELLAR_PLATFORM_SECRET;
          if (!platformSecret) {
            throw new InternalServerErrorException(
              'STELLAR_PLATFORM_SECRET environment variable is not set',
            );
          }

          const sourceKeyPair = StellarSdk.Keypair.fromSecret(platformSecret);
          const server = new StellarSdk.Horizon.Server(
            this.stellarService.horizonUrl,
          );

          const sourceAccount = await server.loadAccount(
            sourceKeyPair.publicKey(),
          );

          const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: this.stellarService.networkPassphrase,
          })
            .addOperation(
              StellarSdk.Operation.payment({
                destination: payout.wallet.address,
                asset: StellarSdk.Asset.native(),
                amount: payout.amount.toString(),
              }),
            )
            .setTimeout(60)
            .build();

          transaction.sign(sourceKeyPair);

          const submitResult = await server.submitTransaction(transaction);

          await tx.payout.update({
            where: { id: payoutId },
            data: {
              status: 'completed',
              transactionId: transaction.hash().toString('hex'),
              onChainTxHash: submitResult.hash,
              confirmedAt: new Date(),
            },
          });

          this.logger.log(
            `Payout ${payoutId} completed in batch. Transaction hash: ${submitResult.hash}`,
          );

          void this.payoutReceiptService.generateAndSendReceipt({
            payoutId: payout.id,
            amount: payout.amount,
            currency: payout.currency,
            method: payout.method,
            transactionId: transaction.hash().toString('hex'),
            onChainTxHash: submitResult.hash,
            confirmedAt: new Date(),
            recipientEmail: payout.user.email,
            walletAddress: payout.wallet.address,
          });
        });

        results.push({ id: payoutId, status: 'completed' });
        processed++;
      } catch (error) {
        this.logger.error(`Batch payout failed for ${payoutId}:`, error);
        results.push({
          id: payoutId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }
    }

    return { processed, failed, results };
  }
}
