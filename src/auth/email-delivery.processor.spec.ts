import { Job } from 'bullmq';
import { EmailDeliveryProcessor } from './email-delivery.processor';

describe('EmailDeliveryProcessor', () => {
  it('throws when SMTP send fails so BullMQ can retry', async () => {
    const mailService = {
      sendTemplatedEmail: jest
        .fn()
        .mockRejectedValue(new Error('SMTP temporarily unavailable')),
    };
    const processor = new EmailDeliveryProcessor(mailService as any);

    const job = {
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
  });
});
