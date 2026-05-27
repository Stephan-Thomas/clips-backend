import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { EncryptionService } from '../encryption/encryption.service';
import { SendTransactionDto } from './dto/send-transaction.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
    private readonly encryption: EncryptionService,
  ) {}

  async send(userId: number, dto: SendTransactionDto): Promise<{ hash: string; destination: string; amount: string }> {
    // Validate destination address
    const validation = this.stellar.validateAddress(dto.destination);
    if (!validation.valid) {
      throw new BadRequestException('Invalid destination Stellar address');
    }

    // Load user's custodial wallet
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stellarPublicKey: true, encryptedStellarSecret: true },
    });

    if (!user?.stellarPublicKey || !user.encryptedStellarSecret) {
      throw new NotFoundException('No custodial Stellar wallet found for this user');
    }

    const secret = this.encryption.decrypt(user.encryptedStellarSecret);
    const keypair = Keypair.fromSecret(secret);

    const server = new Horizon.Server(this.stellar.horizonUrl);

    try {
      const account = await server.loadAccount(keypair.publicKey());

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.stellar.networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: dto.destination,
            asset: Asset.native(),
            amount: dto.amount,
          }),
        )
        .setTimeout(60)
        .build();

      tx.sign(keypair);

      const result = await server.submitTransaction(tx);

      this.logger.log(`Transaction submitted for user ${userId}: ${result.hash}`);

      return { hash: result.hash, destination: dto.destination, amount: dto.amount };
    } catch (error) {
      this.logger.error(`Transaction failed for user ${userId}:`, error);
      throw new InternalServerErrorException('Failed to submit Stellar transaction');
    }
  }
}
