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

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly minPayoutAmount: number;

  constructor(
    private prisma: PrismaService,
    private stellarService: StellarService,
  ) {
    this.minPayoutAmount = parseFloat(
      process.env.MIN_STELLAR_PAYOUT ?? '5',
    );
  }

  async requestPayout(userId: number): Promise<{
    id: number;
    amount: number;
    status: string;
    createdAt: Date;
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
      where: { clip: { video: { userId } } },
      _sum: { amount: true },
    });

    const totalPaidOut = await this.prisma.payout.aggregate({
      where: { userId, status: { in: ['completed', 'processing'] } },
      _sum: { amount: true },
    });

    const pendingBalance =
      (totalEarnings._sum.amount ?? 0) -
      (totalPaidOut._sum.amount ?? 0);

    if (pendingBalance < this.minPayoutAmount) {
      throw new BadRequestException(
        `Minimum payout amount is $${this.minPayoutAmount}. Your pending balance is $${pendingBalance.toFixed(2)}.`,
      );
    }

    // Create payout record
    const payout = await this.prisma.payout.create({
      data: {
        userId,
        walletId: wallet.id,
        amount: pendingBalance,
        currency: 'USD',
        method: 'stellar',
        status: 'pending',
      },
    });

    return {
      id: payout.id,
      amount: payout.amount,
      status: payout.status,
      createdAt: payout.createdAt,
    };
  }

  async getPayoutHistory(userId: number): Promise<
    Array<{
      id: number;
      amount: number;
      currency: string;
      method: string;
      status: string;
      transactionId: string | null;
      onChainTxHash: string | null;
      createdAt: Date;
      confirmedAt: Date | null;
    }>
  > {
    return this.prisma.payout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        currency: true,
        method: true,
        status: true,
        transactionId: true,
        onChainTxHash: true,
        createdAt: true,
        confirmedAt: true,
      },
    });
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
}
