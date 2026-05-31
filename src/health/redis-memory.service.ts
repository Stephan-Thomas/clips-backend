import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RedisService } from '../redis/redis.service';

export interface RedisMemoryStats {
  usedMemoryBytes: number;
  maxMemoryBytes: number;
  usedMemoryHuman: string;
  maxMemoryHuman: string;
  usedMemoryRssBytes: number;
  memFragmentationRatio: number;
  /** null when Redis has no memory limit configured */
  usagePercent: number | null;
  isAboveThreshold: boolean;
  alert: string | null;
  checkedAt: string;
}

export const MEMORY_ALERT_THRESHOLD_PERCENT = 80;

/** Periodic log interval: every 5 minutes */
const LOG_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class RedisMemoryService {
  private readonly logger = new Logger(RedisMemoryService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Collects current Redis memory stats, evaluates the alert threshold,
   * and returns a structured payload.
   */
  async getStats(): Promise<RedisMemoryStats> {
    const info = await this.redisService.getMemoryInfo();

    const isAboveThreshold =
      info.usagePercent !== null &&
      info.usagePercent > MEMORY_ALERT_THRESHOLD_PERCENT;

    const alert = isAboveThreshold
      ? `Redis memory usage is at ${info.usagePercent}%, which exceeds the ${MEMORY_ALERT_THRESHOLD_PERCENT}% threshold. OOM risk is elevated.`
      : null;

    return {
      ...info,
      isAboveThreshold,
      alert,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Runs on a fixed interval to log Redis memory statistics.
   * Emits a warning when usage exceeds the configured threshold.
   */
  @Interval(LOG_INTERVAL_MS)
  async logMemoryStats(): Promise<void> {
    try {
      const stats = await this.getStats();

      const logPayload = {
        usedMemory: stats.usedMemoryHuman,
        maxMemory: stats.maxMemoryHuman,
        usagePercent: stats.usagePercent,
        memFragmentationRatio: stats.memFragmentationRatio,
        alert: stats.alert,
      };

      if (stats.isAboveThreshold) {
        this.logger.warn('Redis memory usage above alert threshold', logPayload);
      } else {
        this.logger.log('Redis memory stats', logPayload);
      }
    } catch (err) {
      this.logger.error(
        `Failed to collect Redis memory stats: ${(err as Error).message}`,
      );
    }
  }
}
