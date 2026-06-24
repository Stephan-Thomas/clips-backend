import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';

const VALID_ADDRESS = 'GC6XOTK6L6LGBKIWH3IRUZPVUY4COGEMW4J5YINOSPKO27YKTUUHTZF3';

const mockPrisma = {
  wallet: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  payout: {
    findFirst: jest.fn(),
  },
};

const mockStellar = {
  validateAddress: jest.fn().mockReturnValue({ valid: true }),
};

describe('WalletsService', () => {
  let service: WalletsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StellarService, useValue: mockStellar },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
    jest.clearAllMocks();
  });

  // ─── connect ───────────────────────────────────────────────────────────────

  describe('connect', () => {
    const dto = { address: VALID_ADDRESS, chain: 'stellar', type: 'freighter' };

    it('upserts and returns the wallet for a valid address', async () => {
      const wallet = { id: 1, userId: 1, ...dto, deletedAt: null };
      mockStellar.validateAddress.mockReturnValue({ valid: true });
      mockPrisma.wallet.upsert.mockResolvedValue(wallet);

      const result = await service.connect(1, dto);
      expect(result).toEqual(wallet);
      expect(mockPrisma.wallet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ userId: 1 }) }),
      );
    });

    it('throws BadRequestException for an invalid Stellar address', async () => {
      mockStellar.validateAddress.mockReturnValue({ valid: false });
      await expect(service.connect(1, dto)).rejects.toThrow(BadRequestException);
    });

    it('clears deletedAt on reconnect (reactivation via upsert)', async () => {
      mockStellar.validateAddress.mockReturnValue({ valid: true });
      mockPrisma.wallet.upsert.mockResolvedValue({ id: 1, deletedAt: null });

      await service.connect(1, dto);
      expect(mockPrisma.wallet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: expect.objectContaining({ deletedAt: null }) }),
      );
    });

    it('supports albedo wallet type', async () => {
      mockStellar.validateAddress.mockReturnValue({ valid: true });
      const wallet = { id: 2, userId: 5, address: VALID_ADDRESS, chain: 'stellar', type: 'albedo', deletedAt: null };
      mockPrisma.wallet.upsert.mockResolvedValue(wallet);
      const result = await service.connect(5, { ...dto, type: 'albedo' });
      expect(result.type).toBe('albedo');
    });
  });

  // ─── disconnect ─────────────────────────────────────────────────────────────

  describe('disconnect', () => {
    const baseWallet = { id: 10, userId: 42, deletedAt: null };

    it('soft-deletes wallet and returns success message', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(baseWallet);
      mockPrisma.payout.findFirst.mockResolvedValue(null);
      mockPrisma.wallet.update.mockResolvedValue({ ...baseWallet, deletedAt: new Date() });

      const result = await service.disconnect(10, 42);
      expect(result).toEqual({ message: 'Wallet disconnected successfully', walletId: 10 });
      expect(mockPrisma.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 10 } }),
      );
    });

    it('throws NotFoundException when wallet does not exist', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      await expect(service.disconnect(999, 42)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when wallet belongs to a different user', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({ ...baseWallet, userId: 99 });
      await expect(service.disconnect(10, 42)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when wallet is already disconnected', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({ ...baseWallet, deletedAt: new Date() });
      await expect(service.disconnect(10, 42)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when pending payout exists', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(baseWallet);
      mockPrisma.payout.findFirst.mockResolvedValue({ id: 1, walletId: 10, status: 'pending' });
      await expect(service.disconnect(10, 42)).rejects.toThrow(ConflictException);
    });

    it('allows disconnect when payout is not pending', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(baseWallet);
      mockPrisma.payout.findFirst.mockResolvedValue(null);
      mockPrisma.wallet.update.mockResolvedValue({ ...baseWallet, deletedAt: new Date() });
      const result = await service.disconnect(10, 42);
      expect(result.walletId).toBe(10);
    });
  });
});
