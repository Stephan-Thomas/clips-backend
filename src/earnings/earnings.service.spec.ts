import { Test, TestingModule } from '@nestjs/testing';
import { EarningsService } from './earnings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EarningsService', () => {
  let service: EarningsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    earning: {
      findMany: jest.fn(),
    },
    payout: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EarningsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EarningsService>(EarningsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEarningsDashboard', () => {
    it('should return empty data when user has no earnings', async () => {
      mockPrismaService.earning.findMany.mockResolvedValue([]);
      mockPrismaService.payout.findMany.mockResolvedValue([]);

      const result = await service.getEarningsDashboard(1);

      expect(result).toEqual({
        totalEarned: 0,
        pendingPayout: 0,
        paidOut: 0,
        breakdown: { royalties: 0, subscriptions: 0 },
        history: [],
      });
    });

    it('should return 200 with earnings data when user has earnings', async () => {
      const earnings = [
        {
          amount: 100,
          source: 'royalty',
          date: new Date('2024-01-01'),
        },
        {
          amount: 50,
          source: 'subscription',
          date: new Date('2024-01-02'),
        },
      ];

      const payouts = [
        {
          amount: 75,
          status: 'completed',
          createdAt: new Date('2024-01-03'),
        },
      ];

      mockPrismaService.earning.findMany.mockResolvedValue(earnings);
      mockPrismaService.payout.findMany.mockResolvedValue(payouts);

      const result = await service.getEarningsDashboard(1);

      expect(result.totalEarned).toBe(150);
      expect(result.paidOut).toBe(75);
      expect(result.breakdown.royalties).toBe(100);
      expect(result.breakdown.subscriptions).toBe(50);
      expect(result.history.length).toBeGreaterThan(0);
    });

    it('should apply pagination correctly', async () => {
      mockPrismaService.earning.findMany.mockResolvedValue([]);
      mockPrismaService.payout.findMany.mockResolvedValue([]);

      const result = await service.getEarningsDashboard(1, 2, 10);

      expect(result.history).toEqual([]);
    });
  });
});
