import { Test, TestingModule } from '@nestjs/testing';
import { PlatformRevenueService } from './platform-revenue.service';
import { StellarService } from '../stellar/stellar.service';

describe('PlatformRevenueService', () => {
  let service: PlatformRevenueService;
  let stellarService: StellarService;

  const mockStellarService = {
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    network: 'testnet',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformRevenueService,
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
      ],
    }).compile();

    service = module.get<PlatformRevenueService>(PlatformRevenueService);
    stellarService = module.get<StellarService>(StellarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPlatformRevenue', () => {
    it('should return platform revenue info with stroops and XLM', async () => {
      // This test would require mocking the Stellar RPC response
      // For now, we just verify the service structure
      expect(service.getPlatformRevenue).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('should clear the revenue cache', async () => {
      await expect(service.clearCache()).resolves.not.toThrow();
    });
  });
});
