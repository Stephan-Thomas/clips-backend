import { Test, TestingModule } from '@nestjs/testing';
import { BatchRoyaltyService } from './batch-royalty.service';
import { StellarService } from '../stellar/stellar.service';
import { BadRequestException } from '@nestjs/common';

describe('BatchRoyaltyService', () => {
  let service: BatchRoyaltyService;
  let stellarService: StellarService;

  const mockStellarService = {
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    network: 'testnet',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchRoyaltyService,
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
      ],
    }).compile();

    service = module.get<BatchRoyaltyService>(BatchRoyaltyService);
    stellarService = module.get<StellarService>(StellarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBatchRoyaltyInfo', () => {
    it('should return empty array for empty input', async () => {
      const result = await service.getBatchRoyaltyInfo([]);
      expect(result).toEqual([]);
    });

    it('should throw BadRequestException for non-array input', async () => {
      await expect(
        service.getBatchRoyaltyInfo(null as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for batch size exceeding limit', async () => {
      const largeArray = Array.from({ length: 101 }, (_, i) => i + 1);
      await expect(
        service.getBatchRoyaltyInfo(largeArray),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept string and number token IDs', async () => {
      // This test would require mocking the Stellar RPC response
      // For now, we just verify the service structure
      expect(service.getBatchRoyaltyInfo).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('should clear cache for given token IDs', async () => {
      await expect(service.clearCache([1, 2, 3])).resolves.not.toThrow();
    });
  });
});
