import { CloudinaryService } from './cloudinary.service';
import { v2 as cloudinary } from 'cloudinary';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

jest.mock('streamifier', () => ({
  createReadStream: jest.fn(() => ({
    pipe: jest.fn(),
  })),
}));

describe('CloudinaryService', () => {
  let service: CloudinaryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CloudinaryService();
  });

  describe('uploadVideoFromBuffer with retries', () => {
    it('succeeds on first attempt', async () => {
      const mockBuffer = Buffer.from('test-video');
      const mockResult = {
        secure_url: 'https://cloudinary.com/video.mp4',
        public_id: 'test-clip',
        resource_type: 'video',
      };

      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (options, callback) => {
          callback(null, mockResult);
          return { on: jest.fn() };
        },
      );

      const result = await service.uploadVideoFromBuffer(
        mockBuffer,
        'test-clip',
        {},
        2,
      );

      expect(result.secure_url).toBe('https://cloudinary.com/video.mp4');
      expect(result.error).toBeUndefined();
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds on second attempt', async () => {
      const mockBuffer = Buffer.from('test-video');
      const mockResult = {
        secure_url: 'https://cloudinary.com/video.mp4',
        public_id: 'test-clip',
        resource_type: 'video',
      };

      let attemptCount = 0;
      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (options, callback) => {
          attemptCount++;
          if (attemptCount === 1) {
            callback(new Error('Network timeout'), null);
          } else {
            callback(null, mockResult);
          }
          return { on: jest.fn() };
        },
      );

      const result = await service.uploadVideoFromBuffer(
        mockBuffer,
        'test-clip',
        {},
        2,
      );

      expect(result.secure_url).toBe('https://cloudinary.com/video.mp4');
      expect(result.error).toBeUndefined();
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(2);
    });

    it('returns error after all retry attempts fail', async () => {
      const mockBuffer = Buffer.from('test-video');

      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (options, callback) => {
          callback(new Error('Persistent network error'), null);
          return { on: jest.fn() };
        },
      );

      const result = await service.uploadVideoFromBuffer(
        mockBuffer,
        'test-clip',
        {},
        2,
      );

      expect(result.secure_url).toBe('');
      expect(result.error).toBe('Persistent network error');
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('uses exponential backoff between retries', async () => {
      const mockBuffer = Buffer.from('test-video');
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      // Mock setTimeout to capture delays
      global.setTimeout = jest.fn((callback: any, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0) as any;
      }) as any;

      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (options, callback) => {
          callback(new Error('Network error'), null);
          return { on: jest.fn() };
        },
      );

      await service.uploadVideoFromBuffer(mockBuffer, 'test-clip', {}, 2);

      // Should have 2 delays (between attempts 1-2 and 2-3)
      expect(delays.length).toBe(2);
      expect(delays[0]).toBe(1000); // First retry: 1000ms
      expect(delays[1]).toBe(2000); // Second retry: 2000ms

      global.setTimeout = originalSetTimeout;
    });
  });
});
