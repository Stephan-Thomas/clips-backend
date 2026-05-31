import { Video, VideoStatus } from '../../src/videos/video.entity';

export function buildVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: 'video-fixture-001',
    userId: 'user-fixture-001',
    status: 'done' as VideoStatus,
    processingError: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:05:00.000Z'),
    ...overrides,
  };
}

export function buildVideoList(
  count: number,
  overrides: Partial<Video> = {},
): Video[] {
  return Array.from({ length: count }, (_, i) =>
    buildVideo({
      id: `video-fixture-${String(i + 1).padStart(3, '0')}`,
      createdAt: new Date(Date.now() - i * 60_000),
      ...overrides,
    }),
  );
}
