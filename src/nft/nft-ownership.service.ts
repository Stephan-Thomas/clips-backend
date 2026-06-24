import { Injectable, Logger } from '@nestjs/common';
import { StellarService } from '../stellar/stellar.service';
import * as StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class NftOwnershipService {
  private readonly logger = new Logger(NftOwnershipService.name);

  constructor(private readonly stellarService: StellarService) {}

  /**
   * Verifies if a wallet address owns at least 1 unit of a specific NFT contract.
   * @param mintAddress The Contract ID of the NFT.
   * @param walletAddress The public key of the user.
   */
  async verifyNFTOwnership(
    mintAddress: string,
    walletAddress: string,
  ): Promise<{ isOwner: boolean; error?: string }> {
    const { rpc, Contract, nativeToScVal, scValToNative, TransactionBuilder, Account } = StellarSdk;
    const server = new rpc.Server(this.stellarService.rpcUrl);

    // Placeholder account for building the simulation transaction
    const sourceAccount = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');

    try {
      const contract = new Contract(mintAddress);
      
      // Build the call for 'balance_of(Address)'
      const tx = new TransactionBuilder(sourceAccount, {
        fee: '100',
        networkPassphrase: this.stellarService.networkPassphrase,
      })
        .addOperation(
          contract.call('balance_of', nativeToScVal(walletAddress, { type: 'address' }))
        )
        .setTimeout(30)
        .build();

      // Simulate the call (No signature required)
      const sim = await server.simulateTransaction(tx);

      const simulation = sim as {
        error?: string;
        results?: Array<{ xdr?: string }>;
      };

      if (simulation.error) {
        return { isOwner: false, error: `Contract error: ${simulation.error}` };
      }

      if (!simulation.results || simulation.results.length === 0) {
        return { isOwner: false, error: 'No response from contract' };
      }

      const result = simulation.results[0];
      if (!result.xdr) {
        return { isOwner: false, error: 'Missing result XDR' };
      }

      const returnValue = StellarSdk.xdr.ScVal.fromXDR(result.xdr, 'base64');
      const balance = scValToNative(returnValue);
      
      return {
        isOwner: Number(balance) > 0,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Ownership check failed: ${message}`);
      return { isOwner: false, error: 'Failed to reach Soroban network' };
    }
  }
}
