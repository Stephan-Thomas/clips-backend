import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClipPublishService } from './clip-publish.service';

const mockPrisma = {
  clip: { findUnique: jest.fn() },
  clipPost: {
    upsert: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockAyrshare = { post: jest.fn() };

const mockUserPlatformService = { findAll: jest.fn() };

function makeService() {
  return new ClipPublishService(
    mockPrisma as any,
    mockAyrshare as any,
    mockUserPlatformService as any,
  );
}

const clip = {
  id: 1,
  clipUrl: 'https://res.cloudinary.com/demo/video/upload/clip.mp4',
  caption: 'Test clip',
  title: 'Test',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.clipPost.upsert.mockRejectedValue(new Error('no unique'));
  mockPrisma.clipPost.create.mockResolvedValue({});
  mockPrisma.clipPost.updateMany.mockResolvedValue({ count: 1 });
});

describe('ClipPublishService.publish', () => {
  it('throws NotFoundException when clip does not exist', async () => {
    mockPrisma.clip.findUnique.mockResolvedValue(null);
    const svc = makeService();
    await expect(svc.publish(99, 1, ['tiktok'])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequestException when clip has no clipUrl', async () => {
    mockPrisma.clip.findUnique.mockResolvedValue({ ...clip, clipUrl: null });
    const svc = makeService();
    await expect(svc.publish(1, 1, ['tiktok'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException when no requested platforms are connected', async () => {
    mockPrisma.clip.findUnique.mockResolvedValue(clip);
    mockUserPlatformService.findAll.mockResolvedValue([{ platform: 'instagram' }]);
    const svc = makeService();
    await expect(svc.publish(1, 1, ['tiktok'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns published status on full success', async () => {
    mockPrisma.clip.findUnique.mockResolvedValue(clip);
    mockUserPlatformService.findAll.mockResolvedValue([
      { platform: 'tiktok' },
      { platform: 'instagram' },
    ]);
    mockAyrshare.post.mockResolvedValue([
      { platform: 'tiktok', success: true, postId: 'tt-123' },
      { platform: 'instagram', success: true, postId: 'ig-456' },
    ]);

    const svc = makeService();
    const { results } = await svc.publish(1, 1, ['tiktok', 'instagram']);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'published')).toBe(true);
  });

  it('retries failed platforms and marks them failed after max attempts', async () => {
    mockPrisma.clip.findUnique.mockResolvedValue(clip);
    mockUserPlatformService.findAll.mockResolvedValue([{ platform: 'tiktok' }]);
    mockAyrshare.post.mockResolvedValue([
      { platform: 'tiktok', success: false, error: 'rate limited' },
    ]);

    const svc = makeService();
    // Speed up retries by mocking setTimeout
    jest.useFakeTimers();
    const publishPromise = svc.publish(1, 1, ['tiktok']);
    // Advance timers for each retry delay
    await jest.runAllTimersAsync();
    const { results } = await publishPromise;
    jest.useRealTimers();

    expect(results[0].status).toBe('failed');
    expect(mockAyrshare.post).toHaveBeenCalledTimes(3); // 3 attempts
  });

  it('handles partial failure — some platforms succeed, some fail', async () => {
    mockPrisma.clip.findUnique.mockResolvedValue(clip);
    mockUserPlatformService.findAll.mockResolvedValue([
      { platform: 'tiktok' },
      { platform: 'instagram' },
    ]);
    // First call: tiktok succeeds, instagram fails
    mockAyrshare.post
      .mockResolvedValueOnce([
        { platform: 'tiktok', success: true, postId: 'tt-1' },
        { platform: 'instagram', success: false, error: 'error' },
      ])
      // Retries for instagram only
      .mockResolvedValue([{ platform: 'instagram', success: false, error: 'still failing' }]);

    const svc = makeService();
    jest.useFakeTimers();
    const publishPromise = svc.publish(1, 1, ['tiktok', 'instagram']);
    await jest.runAllTimersAsync();
    const { results } = await publishPromise;
    jest.useRealTimers();

    const tiktok = results.find((r) => r.platform === 'tiktok');
    const instagram = results.find((r) => r.platform === 'instagram');
    expect(tiktok?.status).toBe('published');
    expect(instagram?.status).toBe('failed');
  });
});
