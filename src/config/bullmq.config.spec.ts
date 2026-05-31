import { ConfigService } from '@nestjs/config';
import {
  getBullMQWorkerConfig,
  validateWorkerConfig,
  BullMQWorkerConfig,
} from './bullmq.config';

describe('BullMQ Configuration', () => {
  describe('getBullMQWorkerConfig', () => {
    it('should return default values when env vars are not set', () => {
      const configService = new ConfigService();
      const config = getBullMQWorkerConfig(configService);

      expect(config.clipGenerationConcurrency).toBe(2);
      expect(config.emailDeliveryConcurrency).toBe(5);
    });

    it('should parse env vars correctly', () => {
      const configService = new ConfigService({
        BULLMQ_CLIP_GENERATION_CONCURRENCY: '4',
        BULLMQ_EMAIL_DELIVERY_CONCURRENCY: '10',
      });
      const config = getBullMQWorkerConfig(configService);

      expect(config.clipGenerationConcurrency).toBe(4);
      expect(config.emailDeliveryConcurrency).toBe(10);
    });

    it('should handle string values', () => {
      const configService = new ConfigService({
        BULLMQ_CLIP_GENERATION_CONCURRENCY: '8',
        BULLMQ_EMAIL_DELIVERY_CONCURRENCY: '20',
      });
      const config = getBullMQWorkerConfig(configService);

      expect(config.clipGenerationConcurrency).toBe(8);
      expect(config.emailDeliveryConcurrency).toBe(20);
    });
  });

  describe('validateWorkerConfig', () => {
    it('should accept valid configuration', () => {
      const config: BullMQWorkerConfig = {
        clipGenerationConcurrency: 4,
        emailDeliveryConcurrency: 10,
      };

      expect(() => validateWorkerConfig(config)).not.toThrow();
    });

    it('should reject clip generation concurrency < 1', () => {
      const config: BullMQWorkerConfig = {
        clipGenerationConcurrency: 0,
        emailDeliveryConcurrency: 5,
      };

      expect(() => validateWorkerConfig(config)).toThrow(
        /BULLMQ_CLIP_GENERATION_CONCURRENCY must be at least 1/,
      );
    });

    it('should reject clip generation concurrency > 20', () => {
      const config: BullMQWorkerConfig = {
        clipGenerationConcurrency: 25,
        emailDeliveryConcurrency: 5,
      };

      expect(() => validateWorkerConfig(config)).toThrow(
        /BULLMQ_CLIP_GENERATION_CONCURRENCY should not exceed 20/,
      );
    });

    it('should reject email delivery concurrency < 1', () => {
      const config: BullMQWorkerConfig = {
        clipGenerationConcurrency: 2,
        emailDeliveryConcurrency: 0,
      };

      expect(() => validateWorkerConfig(config)).toThrow(
        /BULLMQ_EMAIL_DELIVERY_CONCURRENCY must be at least 1/,
      );
    });

    it('should reject email delivery concurrency > 50', () => {
      const config: BullMQWorkerConfig = {
        clipGenerationConcurrency: 2,
        emailDeliveryConcurrency: 60,
      };

      expect(() => validateWorkerConfig(config)).toThrow(
        /BULLMQ_EMAIL_DELIVERY_CONCURRENCY should not exceed 50/,
      );
    });

    it('should accept boundary values', () => {
      const minConfig: BullMQWorkerConfig = {
        clipGenerationConcurrency: 1,
        emailDeliveryConcurrency: 1,
      };
      expect(() => validateWorkerConfig(minConfig)).not.toThrow();

      const maxConfig: BullMQWorkerConfig = {
        clipGenerationConcurrency: 20,
        emailDeliveryConcurrency: 50,
      };
      expect(() => validateWorkerConfig(maxConfig)).not.toThrow();
    });

    it('should collect multiple validation errors', () => {
      const config: BullMQWorkerConfig = {
        clipGenerationConcurrency: 0,
        emailDeliveryConcurrency: 60,
      };

      expect(() => validateWorkerConfig(config)).toThrow(
        /BULLMQ_CLIP_GENERATION_CONCURRENCY must be at least 1/,
      );
      expect(() => validateWorkerConfig(config)).toThrow(
        /BULLMQ_EMAIL_DELIVERY_CONCURRENCY should not exceed 50/,
      );
    });
  });
});
