import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class StellarService {
  readonly network: 'testnet' | 'public';
  readonly rpcUrl: string;
  readonly networkPassphrase: string;

  constructor(private readonly config: ConfigService) {
    this.network =
      (config.get<string>('STELLAR_NETWORK') as 'testnet' | 'public') ?? 'testnet';

    if (this.network === 'public') {
      this.rpcUrl = 'https://soroban-rpc.stellar.org';
      this.networkPassphrase = StellarSdk.Networks.PUBLIC;
    } else {
      this.rpcUrl = 'https://soroban-testnet.stellar.org';
      this.networkPassphrase = StellarSdk.Networks.TESTNET;
    }
  }

  isTestnet(): boolean {
    return this.network === 'testnet';
  }

  validateAddress(address: string): { valid: boolean } {
    const valid = StellarSdk.StrKey.isValidEd25519PublicKey(address);
    return { valid };
  }

  async fundWithFriendbot(publicKey: string): Promise<void> {
    const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`;
    await fetch(url);
  }
}
