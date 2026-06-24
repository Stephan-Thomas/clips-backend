import { Job } from 'bullmq';
import { EmailDeliveryJobData, EMAIL_JOB_OPTIONS } from './email-delivery.queue';

// Mock missing / side-effect-heavy modules before any imports resolve them
jest.mock('../metrics/metrics.service', () => ({ MetricsService: class {} }));
jest.mock('../config/bullmq.config', () => ({
  getBullMQWorkerConfig: jest.fn().mockReturnValue({ emailDeliveryConcurrency: 5 }),
}));

import { EmailDeliveryProcessor } from './email-delivery.processor';

describe('EmailDeliveryProcessor', () => {
  it('throws when SMTP send fails so BullMQ can retry', async () => {
    const mailService = {
      sendTemplatedEmail: jest
        .fn()
        .mockRejectedValue(new Error('SMTP temporarily unavailable')),
    };
    const metricsService = {
      recordJobStart: jest.fn(),
      recordJobCompletion: jest.fn(),
      recordJobFailure: jest.fn(),
    };
    const processor = new EmailDeliveryProcessor(
      mailService as any,
      metricsService as any,
    );

    const job = {
      id: 'job-1',
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        to: 'user@example.com',
        subject: 'Verify your email address',
        template: 'verification',
        context: { token: 'abc' },
      },
    } as Job<any>;

    await expect(processor.process(job)).rejects.toThrow(
      'SMTP temporarily unavailable',
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
