import { Job } from 'bullmq';
import { AnomalyDetectionProcessor } from './anomaly-detection.processor';
import { ANOMALY_DETECTION_QUEUE } from './anomaly-detection.queue';

// Mock missing modules before processor imports resolve them
jest.mock('../metrics/metrics.service', () => ({ MetricsService: class {} }));

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockAnomalyDetectionService = { detectAnomalies: jest.fn() };
const mockMailService = { sendMail: jest.fn() };
const mockMetricsService = {
  recordJobStart: jest.fn(),
  recordJobCompletion: jest.fn(),
  recordJobFailure: jest.fn(),
};

function makeProcessor() {
  return new AnomalyDetectionProcessor(
    mockAnomalyDetectionService as any,
    mockMailService as any,
    mockMetricsService as any,
  );
}

function makeJob(earningId = 99): Job<{ earningId: number }> {
  return {
    id: 'anomaly-job-1',
    data: { earningId },
    opts: { attempts: 3 },
    attemptsMade: 0,
  } as unknown as Job<{ earningId: number }>;
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.ADMIN_EMAILS;
});

// ── handleAnomalyDetection() ──────────────────────────────────────────────────

describe('AnomalyDetectionProcessor.handleAnomalyDetection()', () => {
  it('calls detectAnomalies with the earningId from job data', async () => {
    mockAnomalyDetectionService.detectAnomalies.mockResolvedValue({ isAnomaly: false });
    const processor = makeProcessor();

    await processor.handleAnomalyDetection(makeJob(99));

    expect(mockAnomalyDetectionService.detectAnomalies).toHaveBeenCalledWith(99);
  });

  it('records job start and completion(success) metrics', async () => {
    mockAnomalyDetectionService.detectAnomalies.mockResolvedValue({ isAnomaly: false });
    const processor = makeProcessor();

    await processor.handleAnomalyDetection(makeJob());

    expect(mockMetricsService.recordJobStart).toHaveBeenCalled();
    expect(mockMetricsService.recordJobCompletion).toHaveBeenCalledWith(
      expect.any(String),
      ANOMALY_DETECTION_QUEUE,
      'success',
    );
    expect(mockMetricsService.recordJobFailure).not.toHaveBeenCalled();
  });

  it('does not call sendMail when no anomaly is detected', async () => {
    mockAnomalyDetectionService.detectAnomalies.mockResolvedValue({ isAnomaly: false });
    const processor = makeProcessor();

    await processor.handleAnomalyDetection(makeJob());

    expect(mockMailService.sendMail).not.toHaveBeenCalled();
  });

  it('does not send admin notification for low-severity anomaly', async () => {
    mockAnomalyDetectionService.detectAnomalies.mockResolvedValue({
      isAnomaly: true,
      severity: 'low',
      reason: 'slightly above average',
    });
    process.env.ADMIN_EMAILS = 'admin@example.com';
    const processor = makeProcessor();

    await processor.handleAnomalyDetection(makeJob());

    expect(mockMailService.sendMail).not.toHaveBeenCalled();
  });

  it('notifies admins for high-severity anomaly', async () => {
    mockAnomalyDetectionService.detectAnomalies.mockResolvedValue({
      isAnomaly: true,
      severity: 'high',
      reason: 'Z-score > 5',
    });
    mockMailService.sendMail.mockResolvedValue(undefined);
    process.env.ADMIN_EMAILS = 'admin@example.com,ops@example.com';
    const processor = makeProcessor();

    await processor.handleAnomalyDetection(makeJob());

    expect(mockMailService.sendMail).toHaveBeenCalledTimes(2);
    expect(mockMailService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: expect.stringContaining('HIGH'),
        text: expect.stringContaining('Z-score > 5'),
      }),
    );
  });

  it('does not throw when ADMIN_EMAILS is not set and anomaly is high-severity', async () => {
    mockAnomalyDetectionService.detectAnomalies.mockResolvedValue({
      isAnomaly: true,
      severity: 'high',
      reason: 'spike',
    });
    const processor = makeProcessor();

    await expect(processor.handleAnomalyDetection(makeJob())).resolves.not.toThrow();
    expect(mockMailService.sendMail).not.toHaveBeenCalled();
  });

  it('records failure metric and rethrows when detectAnomalies throws', async () => {
    mockAnomalyDetectionService.detectAnomalies.mockRejectedValue(
      new Error('DB connection lost'),
    );
    const processor = makeProcessor();

    await expect(processor.handleAnomalyDetection(makeJob())).rejects.toThrow(
      'DB connection lost',
    );

    expect(mockMetricsService.recordJobCompletion).toHaveBeenCalledWith(
      expect.any(String),
      ANOMALY_DETECTION_QUEUE,
      'failure',
    );
    expect(mockMetricsService.recordJobFailure).toHaveBeenCalled();
  });

  it('continues processing remaining admins when one notification fails', async () => {
    mockAnomalyDetectionService.detectAnomalies.mockResolvedValue({
      isAnomaly: true,
      severity: 'high',
      reason: 'spike',
    });
    mockMailService.sendMail
      .mockRejectedValueOnce(new Error('SMTP error'))
      .mockResolvedValueOnce(undefined);
    process.env.ADMIN_EMAILS = 'bad@example.com,good@example.com';
    const processor = makeProcessor();

    // Should not throw — failed notifications are logged but not re-thrown
    await expect(processor.handleAnomalyDetection(makeJob())).resolves.not.toThrow();
    expect(mockMailService.sendMail).toHaveBeenCalledTimes(2);
  });
});
