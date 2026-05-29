import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from '../../redis/redis.service';

/**
 * Redis-backed throttler storage for @nestjs/throttler v6.
 *
 * Key format:  throttler:<throttlerName>:<key>
 * Block key:   throttler:<throttlerName>:<key>:blocked
 *
 * Uses a simple counter window: INCR + EXPIRE so the TTL is a sliding
 * window from the first hit in that window.
 */
@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage {
  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redis = this.redisService.getClient();

    const counterKey = `throttler:${throttlerName}:${key}`;
    const blockKey = `${counterKey}:blocked`;
    const blockSeconds = Math.ceil(blockDuration / 1000);

    // Check if the client is already in a block window
    const blocked = await redis.get(blockKey);
    if (blocked) {
      const blockTtl = await redis.pttl(blockKey);
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.max(0, blockTtl),
      };
    }

    // Atomically increment and set the TTL on first hit
    const pipeline = redis.pipeline();
    pipeline.incr(counterKey);
    pipeline.pttl(counterKey);
    const [[incrErr, totalHits], [pttlErr, remainingMs]] =
      (await pipeline.exec()) as [[Error | null, number], [Error | null, number]];

    if (incrErr || pttlErr) {
      // Fail open — don't block on Redis errors
      return { totalHits: 0, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
    }

    // Set expiry only on the first increment (pttl returns -1 when no TTL set)
    if (remainingMs === -1) {
      await redis.pexpire(counterKey, ttl);
    }

    const timeToExpire = remainingMs === -1 ? ttl : remainingMs;
    const isBlocked = totalHits > limit;

    if (isBlocked && blockSeconds > 0) {
      await redis.set(blockKey, '1', 'EX', blockSeconds);
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked ? blockSeconds * 1000 : 0,
    };
  }
}
