/**
 * Reusable Cloudinary mock for E2E / integration tests in the test/ directory.
 *
 * Usage:
 *   jest.mock('cloudinary', () => require('../mocks/cloudinary.mock'));
 */

export const FAKE_SECURE_URL =
  'https://res.cloudinary.com/demo/video/upload/clips/test-clip.mp4';
export const FAKE_PUBLIC_ID = 'clips/test-clip';

export const defaultUploadResult = {
  secure_url: FAKE_SECURE_URL,
  public_id: FAKE_PUBLIC_ID,
  resource_type: 'video',
};

export const v2 = {
  config: jest.fn(),
  uploader: {
    /** Simulates a successful upload. Override per-test via mockImplementation. */
    upload_stream: jest.fn().mockImplementation((_options: unknown, callback: Function) => {
      callback(null, defaultUploadResult);
      return { on: jest.fn() };
    }),
    destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
  },
};

export default { v2 };
