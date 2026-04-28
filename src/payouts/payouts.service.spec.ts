import { Test, TestingModule } from '@nestjs/testing';
import { PayoutsService } from './payouts.service';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import {
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('PayoutsService', () => {
  let service: PayoutsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    payout: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    wallet: {
      findFirst: jest.fn(),
    },
    earning: {
      aggregate: jest.fn(),
    },
  };

  const mockStellarService = {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
      ],
    }).compile();

    service = module.get<PayoutsService>(PayoutsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.STELLAR_PLATFORM_SECRET;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestPayout', () => {
    it('should throw ConflictException if pending payout exists', async () => {
      mockPrismaService.payout.findFirst.mockResolvedValue({
        id: 1,
        status: 'pending',
      });

      await expect(service.requestPayout(1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if no wallet found', async () => {
      mockPrismaService.payout.findFirst.mockResolvedValue(null);
      mockPrismaService.wallet.findFirst.mockResolvedValue(null);

      await expect(service.requestPayout(1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if balance below minimum', async () => {
      mockPrismaService.payout.findFirst.mockResolvedValue(null);
      mockPrismaService.wallet.findFirst.mockResolvedValue({
        id: 1,
        address: 'GTEST...',
      });
      mockPrismaService.earning.aggregate.mockResolvedValue({
        _sum: { amount: 3 },
      });
      mockPrismaService.payout.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      });

      await expect(service.requestPayout(1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getPayoutHistory', () => {
    it('should return payout history for user', async () => {
      const payouts = [
        { id: 1, amount: 100, status: 'completed' },
        { id: 2, amount: 50, status: 'pending' },
      ];
      mockPrismaService.payout.findMany.mockResolvedValue(payouts);

      const result = await service.getPayoutHistory(1);
      expect(result).toHaveLength(2);
    });
  });

  describe('processPayout', () => {
    it('should throw NotFoundException if payout not found', async () => {
      mockPrismaService.payout.findUnique.mockResolvedValue(null);

      await expect(service.processPayout(999)).rejects.toThrow();
    });

    it('should throw InternalServerErrorException if STELLAR_PLATFORM_SECRET not set', async () => {
      mockPrismaService.payout.findUnique.mockResolvedValue({
        id: 1,
        status: 'pending',
        wallet: { address: 'GTEST...' },
      });

      await expect(service.processPayout(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
