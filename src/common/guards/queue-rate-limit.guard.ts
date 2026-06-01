import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';

export const QUEUE_RATE_LIMIT_KEY = 'queue_rate_limit';

export interface QueueRateLimitOptions {
  /** Max active jobs per user */
  maxJobs: number;
  /** Redis key prefix */
  queue: string;
}

export const QueueRateLimit = (options: QueueRateLimitOptions) =>
  Reflect.metadata(QUEUE_RATE_LIMIT_KEY, options);

/**
 * Guard that limits how many active queue jobs a user can have at once.
 * Uses Redis INCR + EXPIRE to track per-user job counts.
 * Returns 429 when the limit is exceeded.
 */
@Injectable()
export class QueueRateLimitGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<QueueRateLimitOptions>(
      QUEUE_RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!options) return true;

    const request = context.switchToHttp().getRequest();
    const userId: number | undefined = request.user?.userId;

    if (!userId) return true; // unauthenticated — let auth guard handle it

    const key = `queue:ratelimit:${options.queue}:user:${userId}`;
    const client = this.redisService.getClient();

    const current = await client.incr(key);
    if (current === 1) {
      // First job in window — set TTL of 1 hour
      await client.expire(key, 3600);
    }

    if (current > options.maxJobs) {
      // Decrement since we won't actually enqueue
      await client.decr(key);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many active jobs. Maximum ${options.maxJobs} concurrent jobs allowed per user.`,
          queue: options.queue,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
