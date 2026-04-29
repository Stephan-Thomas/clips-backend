export const EMAIL_DELIVERY_QUEUE = 'email-delivery';
export const EMAIL_DELIVERY_JOB = 'deliver-email';

export type EmailTemplate = 'verification' | 'password-reset' | 'magic-link';

export interface EmailDeliveryJobData {
  to: string;
  subject: string;
  template: EmailTemplate;
  context: {
    token: string;
  };
}
