import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { StellarService } from '../stellar/stellar.service';
import StellarSdk from '@stellar/stellar-sdk';
import Redis from 'ioredis';

const CACHE_TTL_SECONDS = 300; // 5 minutes

export interface BatchRoyaltyInfo {
  tokenId: string;
  recipient: string;
  feeNumerator: number;
  feeDenominator: number;
  royaltyPercentage: string; // Human-readable percentage (e.g., "5.00%")
}

/**
 * Service for batch querying royalty information from the NFT smart contract.
 * Allows fetching royalty data for multiple tokens in a single RPC call.
 */
@Injectable()
export class BatchRoyaltyService {
  private readonly logger = new Logger(BatchRoyaltyService.name);
  private readonly redis: Redis;

  private readonly CONTRACT_ID =
    process.env.SOROBAN_NFT_CONTRACT_ID ||
    'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEU4';

  constructor(private readonly stellarService: StellarService) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
    });
  }

  /**
   * Batch query royalty information for multiple tokens.
   * Results are cached in Redis for 5 minutes per batch.
   * 
   * @param tokenIds - Array of token IDs (as strings or numbers)
   * @param skipCache - Optional flag to bypass cache
   * @returns Array of royalty info in the same order as input
   */
  async getBatchRoyaltyInfo(
    tokenIds: (string | number)[],
    skipCache = false,
  ): Promise<BatchRoyaltyInfo[]> {
    // Validate input
    if (!Array.isArray(tokenIds)) {
      throw new BadRequestException('tokenIds must be an array');
    }

    if (tokenIds.length === 0) {
      return [];
    }

    // Limit batch size to prevent RPC timeouts
    const MAX_BATCH_SIZE = 100;
    if (tokenIds.length > MAX_BATCH_SIZE) {
      throw new BadRequestException(
        `Batch size exceeds maximum of ${MAX_BATCH_SIZE} tokens. ` +
        `Please split your request into smaller batches.`,
      );
    }

    // Convert all token IDs to strings for consistent caching
    const normalizedIds = tokenIds.map((id) => String(id));
    const cacheKey = `batch_royalty:${normalizedIds.join(',')}`;

    // Try cache first
    if (!skipCache) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for batch royalty: ${normalizedIds.length} tokens`);
          return JSON.parse(cached) as BatchRoyaltyInfo[];
        }
      } catch (err) {
        this.logger.warn(
          `Redis read failed for ${cacheKey}: ${(err as Error).message}`,
        );
      }
    }

    // Query on-chain
    const result = await this.queryBatchRoyaltyOnChain(normalizedIds);

    // Cache the result
    try {
      await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));
    } catch (err) {
      this.logger.warn(
        `Redis write failed for ${cacheKey}: ${(err as Error).message}`,
      );
    }

    return result;
  }

  /**
   * Query the smart contract's batch_royalty_info function.
   */
  private async queryBatchRoyaltyOnChain(
    tokenIds: string[],
  ): Promise<BatchRoyaltyInfo[]> {
    const server = new StellarSdk.rpc.Server(this.stellarService.rpcUrl);
    const contract = new StellarSdk.Contract(this.CONTRACT_ID);

    // Convert token IDs to ScVal vector
    const tokenIdsVec = tokenIds.map((id) => {
      const tokenIdNum = parseInt(id, 10);
      if (isNaN(tokenIdNum) || tokenIdNum < 0) {
        throw new BadRequestException(
          `Invalid token ID: "${id}". Expected a non-negative integer.`,
        );
      }
      return StellarSdk.nativeToScVal(BigInt(tokenIdNum), { type: 'u128' });
    });

    const tokenIdsScVal = StellarSdk.nativeToScVal(tokenIdsVec, { type: 'Vec' });

    // Build contract call
    const op = contract.call('batch_royalty_info', tokenIdsScVal);

    // Use dummy account for read-only simulation
    const dummyAccount = new StellarSdk.Account(
      'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
      '0',
    );

    const tx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: this.stellarService.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(StellarSdk.TimeoutInfinite)
      .build();

    let simulation: Awaited<ReturnType<typeof server.simulateTransaction>>;
    try {
      simulation = await server.simulateTransaction(tx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Soroban simulation failed for batch_royalty_info: ${msg}`,
      );
      throw new InternalServerErrorException(
        `Failed to query batch royalty from contract: ${msg}`,
      );
    }

    if ((simulation as { error?: string }).error) {
      throw new InternalServerErrorException(
        `Contract returned error: ${(simulation as { error: string }).error}`,
      );
    }

    const results = (simulation as { results?: Array<{ xdr: string }> })
      .results;

    if (!results?.[0]?.xdr) {
      throw new InternalServerErrorException(
        'No return value from batch_royalty_info contract call',
      );
    }

    const returnValue = StellarSdk.xdr.ScVal.fromXDR(results[0].xdr, 'base64');
    const batchResults = StellarSdk.scValToNative(returnValue) as Array<{
      token_id: bigint;
      recipient: string;
      fee_numerator: number;
      fee_denominator: number;
    }>;

    // Transform to our response format
    return batchResults.map((item) => {
      const percentage =
        item.fee_denominator > 0
          ? ((item.fee_numerator / item.fee_denominator) * 100).toFixed(2)
          : '0.00';

      return {
        tokenId: item.token_id.toString(),
        recipient: item.recipient,
        feeNumerator: item.fee_numerator,
        feeDenominator: item.fee_denominator,
        royaltyPercentage: `${percentage}%`,
      };
    });
  }

  /**
   * Clear cache for specific token IDs.
   */
  async clearCache(tokenIds: (string | number)[]): Promise<void> {
    const normalizedIds = tokenIds.map((id) => String(id));
    const cacheKey = `batch_royalty:${normalizedIds.join(',')}`;

    try {
      await this.redis.del(cacheKey);
      this.logger.debug(`Cleared cache for batch: ${normalizedIds.join(',')}`);
    } catch (err) {
      this.logger.warn(
        `Failed to clear batch royalty cache: ${(err as Error).message}`,
      );
    }
  }
}
