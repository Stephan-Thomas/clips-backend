import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { ConnectWalletDto } from './dto/connect-wallet.dto';

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
  ) {}

  async connect(userId: number, dto: ConnectWalletDto) {
    const { valid } = this.stellar.validateAddress(dto.address);
    if (!valid) {
      throw new BadRequestException('Invalid Stellar address');
    }

    return this.prisma.wallet.upsert({
      where: { address_chain: { address: dto.address, chain: dto.chain } },
      update: { userId, type: dto.type, deletedAt: null },
      create: { userId, address: dto.address, chain: dto.chain, type: dto.type },
    });
  }

  async disconnect(walletId: number, userId: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });

    if (!wallet || wallet.userId !== userId) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.deletedAt !== null) {
      throw new ConflictException('Wallet is already disconnected');
    }

    const pending = await this.prisma.payout.findFirst({
      where: { walletId, status: 'pending' },
    });
    if (pending) {
      throw new ConflictException('Cannot disconnect wallet with pending payouts');
    }

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Wallet disconnected successfully', walletId };
  }
}
