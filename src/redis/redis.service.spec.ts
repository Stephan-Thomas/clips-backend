import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import Redis from 'ioredis';

jest.mock('ioredis');

describe('RedisService', () => {
  let service: RedisService;
  let mockRedisClient: jest.Mocked<Redis>;

  beforeEach(async () => {
    mockRedisClient = {
      on: jest.fn(),
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      ping: jest.fn(),
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(
      () => mockRedisClient,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return value when Redis succeeds', async () => {
      mockRedisClient.get.mockResolvedValue('test-value');
      const result = await service.get('test-key');
      expect(result).toBe('test-value');
    });

    it('should return null when Redis fails', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      const result = await service.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('setex', () => {
    it('should not throw when Redis succeeds', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');
      await expect(
        service.setex('test-key', 60, 'test-value'),
      ).resolves.not.toThrow();
    });

    it('should not throw when Redis fails', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Redis error'));
      await expect(
        service.setex('test-key', 60, 'test-value'),
      ).resolves.not.toThrow();
    });
  });

  describe('del', () => {
    it('should not throw when Redis succeeds', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      await expect(service.del('test-key')).resolves.not.toThrow();
    });

    it('should not throw when Redis fails', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));
      await expect(service.del('test-key')).resolves.not.toThrow();
    });
  });

  describe('ping', () => {
    it('should return true when Redis responds with PONG', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      const result = await service.ping();
      expect(result).toBe(true);
    });

    it('should return false when Redis fails', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis error'));
      const result = await service.ping();
      expect(result).toBe(false);
    });
  });
});
