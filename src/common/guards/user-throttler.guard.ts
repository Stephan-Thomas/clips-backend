import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Extends ThrottlerGuard to key rate limits by authenticated user ID
 * when available, falling back to IP for unauthenticated requests.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    return userId ? `user:${userId}` : (req.ip as string);
  }

  protected getErrorMessage(): string {
    return 'Too many requests. Please try again later.';
  }

  async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
    throttler: any,
    storage: any,
    generateKey: any,
  ): Promise<boolean> {
    const result = await super.handleRequest(
      context,
      limit,
      ttl,
      throttler,
      storage,
      generateKey,
    );

    const res = context.switchToHttp().getResponse();
    // Attach rate-limit headers
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-RateLimit-Limit', limit);
    }

    return result;
  }
}
