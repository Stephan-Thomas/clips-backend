import { Job } from 'bullmq';
import { EmailDeliveryJobData, EMAIL_JOB_OPTIONS } from './email-delivery.queue';

// Mock missing / side-effect-heavy modules before any imports resolve them
jest.mock('../metrics/metrics.service', () => ({ MetricsService: class {} }));
jest.mock('../config/bullmq.config', () => ({
  getBullMQWorkerConfig: jest.fn().mockReturnValue({ emailDeliveryConcurrency: 5 }),
}));

import { EmailDeliveryProcessor } from './email-delivery.processor';

// ── helpers ──────────────────────────────────────────────────────────────────

const mockMailService = { sendTemplatedEmail: jest.fn() };
const mockMetricsService = {
  recordJobStart: jest.fn(),
  recordJobCompletion: jest.fn(),
  recordJobFailure: jest.fn(),
};

function makeProcessor() {
  return new EmailDeliveryProcessor(mockMailService as any, mockMetricsService as any);
}

function makeJob(overrides: Partial<Job<EmailDeliveryJobData>> = {}): Job<EmailDeliveryJobData> {
  return {
    id: 'email-job-1',
    data: {
      to: 'user@example.com',
      subject: 'Verify your email',
      template: 'verification',
      context: { token: 'tok-abc' },
    },
    opts: { attempts: EMAIL_JOB_OPTIONS.attempts, backoff: EMAIL_JOB_OPTIONS.backoff },
    attemptsMade: 0,
    ...overrides,
  } as unknown as Job<EmailDeliveryJobData>;
}

beforeEach(() => jest.clearAllMocks());

// ── process() ────────────────────────────────────────────────────────────────

describe('EmailDeliveryProcessor.process()', () => {
  it('calls sendTemplatedEmail with the full job data', async () => {
    mockMailService.sendTemplatedEmail.mockResolvedValue(undefined);
    const processor = makeProcessor();
    const job = makeJob();

    await processor.process(job);

    expect(mockMailService.sendTemplatedEmail).toHaveBeenCalledWith(job.data);
  });

  it('records job start and completion(success) metrics', async () => {
    mockMailService.sendTemplatedEmail.mockResolvedValue(undefined);
    const processor = makeProcessor();

    await processor.process(makeJob());

    expect(mockMetricsService.recordJobStart).toHaveBeenCalled();
    expect(mockMetricsService.recordJobCompletion).toHaveBeenCalledWith(
      expect.any(String),
      'email-delivery',
      'success',
    );
    expect(mockMetricsService.recordJobFailure).not.toHaveBeenCalled();
  });

  it('records failure metric and rethrows on SMTP error', async () => {
    mockMailService.sendTemplatedEmail.mockRejectedValue(new Error('SMTP connection refused'));
    const processor = makeProcessor();

    await expect(processor.process(makeJob())).rejects.toThrow('SMTP connection refused');

    expect(mockMetricsService.recordJobCompletion).toHaveBeenCalledWith(
      expect.any(String),
      'email-delivery',
      'failure',
    );
    expect(mockMetricsService.recordJobFailure).toHaveBeenCalled();
  });

  it('throws so BullMQ can retry on transient SMTP failure', async () => {
    mockMailService.sendTemplatedEmail.mockRejectedValue(
      new Error('SMTP temporarily unavailable'),
    );
    const processor = makeProcessor();

    await expect(processor.process(makeJob())).rejects.toThrow('SMTP temporarily unavailable');
  });
});

// ── onFailed() ────────────────────────────────────────────────────────────────

describe('EmailDeliveryProcessor.onFailed()', () => {
  it('does not record final_failure on intermediate attempts', () => {
    const processor = makeProcessor();
    const job = makeJob({ attemptsMade: 1 }); // 2nd attempt, 3 retries left

    processor.onFailed(job, new Error('transient'));

    expect(mockMetricsService.recordJobFailure).not.toHaveBeenCalledWith(
      expect.any(String),
      'final_failure',
    );
  });

  it('records final_failure metric after all attempts are exhausted', () => {
    const processor = makeProcessor();
    const job = makeJob({ attemptsMade: EMAIL_JOB_OPTIONS.attempts }); // final attempt

    processor.onFailed(job, new Error('permanent failure'));

    expect(mockMetricsService.recordJobFailure).toHaveBeenCalledWith(
      'email-delivery',
      'final_failure',
    );
  });
});

// ── EMAIL_JOB_OPTIONS ─────────────────────────────────────────────────────────

describe('EMAIL_JOB_OPTIONS', () => {
  it('configures 5 attempts with exponential backoff at 500ms', () => {
    expect(EMAIL_JOB_OPTIONS.attempts).toBe(5);
    expect(EMAIL_JOB_OPTIONS.backoff.type).toBe('exponential');
    expect(EMAIL_JOB_OPTIONS.backoff.delay).toBe(500);
  });

  it('removes completed jobs and keeps failed ones', () => {
    expect(EMAIL_JOB_OPTIONS.removeOnComplete).toBe(true);
    expect(EMAIL_JOB_OPTIONS.removeOnFail).toBe(false);
  });
});
