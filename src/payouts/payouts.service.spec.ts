jest.mock('../stellar/stellar.service', () => ({
  StellarService: jest.fn().mockImplementation(() => ({
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PayoutsService } from './payouts.service';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { PayoutReceiptService } from './payout-receipt.service';
import {
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

describe('PayoutsService', () => {
  let service: PayoutsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    payout: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
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

  const mockPayoutReceiptService = {
    generateAndSendReceipt: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: PayoutReceiptService,
          useValue: mockPayoutReceiptService,
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

  describe('getPayouts', () => {
    it('should return all payouts for user', async () => {
      const payouts = [
        { id: 1, amount: 100, status: 'completed' },
        { id: 2, amount: 50, status: 'pending' },
      ];
      mockPrismaService.payout.findMany.mockResolvedValue(payouts);

      const result = await service.getPayouts(1);
      expect(result).toHaveLength(2);
      expect(mockPrismaService.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1 },
        }),
      );
    });

    it('should filter payouts by status', async () => {
      mockPrismaService.payout.findMany.mockResolvedValue([]);

      await service.getPayouts(1, 'pending');

      expect(mockPrismaService.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1, status: 'pending' },
        }),
      );
    });

    it('should throw BadRequestException for invalid status', async () => {
      await expect(service.getPayouts(1, 'processing')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getPayoutById', () => {
    it('should return payout when owned by user', async () => {
      const payout = { id: 5, userId: 1, amount: 100, status: 'completed' };
      mockPrismaService.payout.findFirst.mockResolvedValue(payout);

      const result = await service.getPayoutById(1, 5);
      expect(result).toEqual(payout);
      expect(mockPrismaService.payout.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5, userId: 1 },
        }),
      );
    });

    it('should throw NotFoundException when payout does not exist', async () => {
      mockPrismaService.payout.findFirst.mockResolvedValue(null);

      await expect(service.getPayoutById(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when payout belongs to another user', async () => {
      mockPrismaService.payout.findFirst.mockResolvedValue(null);

      await expect(service.getPayoutById(2, 5)).rejects.toThrow(
        NotFoundException,
      );
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
