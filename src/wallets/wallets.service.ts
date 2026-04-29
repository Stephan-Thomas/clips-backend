import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectWalletDto } from './dto/connect-wallet.dto';
import { StellarService } from '../stellar/stellar.service';

export interface DisconnectResult {
  message: string;
  walletId: number;
}

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stellarService: StellarService,
  ) {}

  /**
   * Soft-delete a wallet by setting `deletedAt`.
   *
   * Guards:
   *  - Wallet must exist and belong to the requesting user
   *  - Wallet must not already be disconnected
   *  - No pending payouts may reference this wallet
   *  - (Future) No active NFTs — add check here when NFT model is persisted
   */
  async disconnect(walletId: number, userId: number): Promise<DisconnectResult> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet || wallet.userId !== userId) {
      // Treat missing + wrong-owner the same to avoid leaking existence
      throw new NotFoundException(`Wallet ${walletId} not found`);
    }

    if (wallet.deletedAt !== null) {
      throw new ConflictException('Wallet is already disconnected');
    }

    // Block if any payout linked to this wallet is still pending
    const pendingPayout = await this.prisma.payout.findFirst({
      where: { walletId, status: 'pending' },
    });

    if (pendingPayout) {
      throw new ConflictException(
        'Cannot disconnect wallet: there are pending payouts attached to it',
      );
    }

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });

    return {
      message: 'Wallet disconnected successfully',
      walletId,
    };
  }

  /**
   * Connect or update a wallet.
   * Validates the Stellar address and upserts the record.
   */
  async connect(userId: number, dto: ConnectWalletDto) {
    const validation = this.stellarService.validateAddress(dto.address);
    if (!validation.valid) {
      throw new BadRequestException('Invalid Stellar address format');
    }

    return this.prisma.wallet.upsert({
      where: {
        address_chain: {
          address: dto.address,
          chain: dto.chain,
        },
      },
      update: {
        userId,
        type: dto.type,
        deletedAt: null, // Reactivate if it was soft-deleted
        updatedAt: new Date(),
      },
      create: {
        userId,
        address: dto.address,
        chain: dto.chain,
        type: dto.type,
      },
    });
  }
}
