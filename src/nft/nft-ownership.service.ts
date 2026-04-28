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

      if (rpc.Api.isSimulationError(sim)) {
        return { isOwner: false, error: `Contract error: ${sim.error}` };
      }

      if (!sim.result) {
        return { isOwner: false, error: 'No response from contract' };
      }

      // Parse the ScVal result back to a native JS number/BigInt
      const balance = scValToNative(sim.result.retval);
      
      return {
        isOwner: Number(balance) > 0,
      };
    } catch (err) {
      this.logger.error(`Ownership check failed: ${err.message}`);
      return { isOwner: false, error: 'Failed to reach Soroban network' };
    }
  }
}
