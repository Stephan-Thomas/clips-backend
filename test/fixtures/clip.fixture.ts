import { Clip } from '../../src/clips/clip.entity';

export function buildClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-fixture-001',
    videoId: 'video-fixture-001',
    userId: 'user-fixture-001',
    startTime: 30,
    endTime: 75,
    duration: 45,
    positionRatio: 0.25,
    transcript: 'This is a sample transcript for the clip fixture.',
    viralityScore: 72,
    clipUrl: 'https://res.cloudinary.com/demo/video/upload/clips/clip-fixture-001.mp4',
    thumbnail: 'https://res.cloudinary.com/demo/video/upload/so_50p/clips/clip-fixture-001.jpg',
    status: 'success',
    error: undefined,
    localFilePath: undefined,
    selected: false,
    postStatus: null,
    caption: '🔥 Check out this viral moment! #shorts #viral',
    royaltyBps: 1000,
    createdAt: new Date('2026-01-15T10:05:00.000Z'),
    updatedAt: new Date('2026-01-15T10:06:00.000Z'),
    ...overrides,
  };
}

export function buildClipList(
  count: number,
  overrides: Partial<Clip> = {},
): Clip[] {
  return Array.from({ length: count }, (_, i) =>
    buildClip({
      id: `clip-fixture-${String(i + 1).padStart(3, '0')}`,
      startTime: i * 60,
      endTime: i * 60 + 45,
      positionRatio: i / Math.max(count, 1),
      viralityScore: Math.round(40 + Math.random() * 55),
      createdAt: new Date(Date.now() - i * 30_000),
      ...overrides,
    }),
  );
}
