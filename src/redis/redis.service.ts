import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
    });

    this.redis.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  getClient(): Redis {
    return this.redis;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (err) {
      this.logger.warn(`Redis get failed for ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, value);
    } catch (err) {
      this.logger.warn(
        `Redis setex failed for ${key}: ${(err as Error).message}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(
        `Redis del failed for ${key}: ${(err as Error).message}`,
      );
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
