import { Test, TestingModule } from '@nestjs/testing';
import { EarningsService } from './earnings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EarningsService - getEarningsByPlatform', () => {
  let service: EarningsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EarningsService,
        {
          provide: PrismaService,
          useValue: {
            earning: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<EarningsService>(EarningsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should group earnings by platform', async () => {
    const mockEarnings = [
      { amount: 100, source: 'tiktok' },
      { amount: 150, source: 'instagram' },
      { amount: 200, source: 'tiktok' },
      { amount: 50, source: 'youtube' },
    ];

    jest.spyOn(prisma.earning, 'findMany').mockResolvedValue(mockEarnings as any);

    const result = await service.getEarningsByPlatform(1);

    expect(result.totalEarnings).toBe(500);
    expect(result.data).toHaveLength(3);
    expect(result.data[0]).toEqual({
      platform: 'tiktok',
      totalEarnings: 300,
      count: 2,
    });
    expect(result.data[1]).toEqual({
      platform: 'instagram',
      totalEarnings: 150,
      count: 1,
    });
    expect(result.data[2]).toEqual({
      platform: 'youtube',
      totalEarnings: 50,
      count: 1,
    });
  });

  it('should handle unknown platforms', async () => {
    const mockEarnings = [
      { amount: 100, source: null },
      { amount: 50, source: 'tiktok' },
    ];

    jest.spyOn(prisma.earning, 'findMany').mockResolvedValue(mockEarnings as any);

    const result = await service.getEarningsByPlatform(1);

    expect(result.data).toHaveLength(2);
    expect(result.data.find(d => d.platform === 'unknown')).toEqual({
      platform: 'unknown',
      totalEarnings: 100,
      count: 1,
    });
  });

  it('should return empty data for user with no earnings', async () => {
    jest.spyOn(prisma.earning, 'findMany').mockResolvedValue([]);

    const result = await service.getEarningsByPlatform(1);

    expect(result.totalEarnings).toBe(0);
    expect(result.data).toHaveLength(0);
  });
});
