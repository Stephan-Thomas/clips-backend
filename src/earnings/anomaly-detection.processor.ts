import { Processor, Process } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { ANOMALY_DETECTION_QUEUE } from './anomaly-detection.queue';
import { MailService } from '../auth/mail.service';

interface AnomalyDetectionJob {
  earningId: number;
}

@Processor(ANOMALY_DETECTION_QUEUE)
export class AnomalyDetectionProcessor {
  private readonly logger = new Logger(AnomalyDetectionProcessor.name);

  constructor(
    private anomalyDetectionService: AnomalyDetectionService,
    private mailService: MailService,
  ) {}

  @Process('detect-anomaly')
  async handleAnomalyDetection(job: Job<AnomalyDetectionJob>) {
    const { earningId } = job.data;

    this.logger.log(`Processing anomaly detection for earning ${earningId}`);

    try {
      const result = await this.anomalyDetectionService.detectAnomalies(
        earningId,
      );

      if (result.isAnomaly && result.severity === 'high') {
        await this.notifyAdmins(result);
      }
    } catch (error) {
      this.logger.error(
        `Anomaly detection failed for earning ${earningId}:`,
        error,
      );
      throw error;
    }
  }

  private async notifyAdmins(result: {
    reason: string;
    severity: string;
  }): Promise<void> {
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];

    if (adminEmails.length === 0) {
      this.logger.warn('No admin emails configured for anomaly notifications');
      return;
    }

    const subject = `[${result.severity.toUpperCase()}] Earnings Anomaly Detected`;
    const text = `A ${result.severity} severity earnings anomaly has been detected:\n\n${result.reason}\n\nPlease review the anomaly alerts in the admin dashboard.`;

    for (const email of adminEmails) {
      try {
        await this.mailService.sendMail({
          to: email.trim(),
          subject,
          text,
        });
        this.logger.log(`Anomaly notification sent to ${email}`);
      } catch (error) {
        this.logger.error(`Failed to send anomaly notification to ${email}:`, error);
      }
    }
  }
}
