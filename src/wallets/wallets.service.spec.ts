import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  wallet: {
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  payout: {
    findFirst: jest.fn(),
  },
};

const baseWallet = {
  id: 1,
  userId: 42,
  address: 'GXYZ',
  chain: 'stellar',
  type: 'custodial',
  deletedAt: null,
  connectedAt: new Date(),
  updatedAt: new Date(),
};

describe('WalletsService.disconnect', () => {
  let service: WalletsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<WalletsService>(WalletsService);
  });

  it('throws NotFoundException when wallet does not exist', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue(null);
    await expect(service.disconnect(99, 42)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when wallet belongs to another user', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue({ ...baseWallet, userId: 99 });
    await expect(service.disconnect(1, 42)).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when wallet is already disconnected', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue({
      ...baseWallet,
      deletedAt: new Date(),
    });
    await expect(service.disconnect(1, 42)).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when pending payouts exist', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue(baseWallet);
    mockPrisma.payout.findFirst.mockResolvedValue({ id: 5, status: 'pending' });
    await expect(service.disconnect(1, 42)).rejects.toThrow(ConflictException);
  });

  it('soft-deletes the wallet and returns success message', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue(baseWallet);
    mockPrisma.payout.findFirst.mockResolvedValue(null);
    mockPrisma.wallet.update.mockResolvedValue({ ...baseWallet, deletedAt: new Date() });

    const result = await service.disconnect(1, 42);

    expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ deletedAt: expect.any(Date) }),
    });
    expect(result).toEqual({ message: 'Wallet disconnected successfully', walletId: 1 });
  });
});

describe('WalletsService.connect', () => {
  let service: WalletsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<WalletsService>(WalletsService);
  });

  const validStellarAddress = 'GDH6VVE7RUCV664TYL5ZTP4YTL6H64XG76Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7';
  // Note: Actually, G... addresses are 56 characters. 
  const realStellarAddress = 'GDH6VVE7RUCV664TYL5ZTP4YTL6H64XG76Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7'; // This is 56 chars

  it('throws BadRequestException for invalid Stellar address', async () => {
    await expect(
      service.connect(42, {
        address: 'invalid-address',
        chain: 'stellar',
        type: 'freighter',
      }),
    ).rejects.toThrow('Invalid Stellar address');
  });

  it('upserts a wallet with valid Stellar address', async () => {
    const dto = {
      address: 'GC6XOTK6L6LGBKIWH3IRUZPVUY4COGEMW4J5YINOSPKO27YKTUUHTZF3',
      chain: 'stellar',
      type: 'freighter',
    };
    mockPrisma.wallet.upsert.mockResolvedValue({
      id: 1,
      userId: 42,
      ...dto,
    });

    const result = await service.connect(42, dto);

    expect(mockPrisma.wallet.upsert).toHaveBeenCalledWith({
      where: {
        address_chain: {
          address: dto.address,
          chain: dto.chain,
        },
      },
      update: expect.objectContaining({
        userId: 42,
        type: dto.type,
      }),
      create: {
        userId: 42,
        address: dto.address,
        chain: dto.chain,
        type: dto.type,
      },
    });
    expect(result.id).toBe(1);
  });
});
