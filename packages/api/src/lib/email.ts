import { logger } from '../middleware/logger';

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

interface SendEmailResult {
  delivered: boolean;
  mode: 'webhook' | 'log';
  error?: string;
}

function resolveEmailWebhookUrl(): string | null {
  const url = process.env.EMAIL_WEBHOOK_URL;
  if (!url || !url.trim()) return null;
  return url.trim();
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const webhookUrl = resolveEmailWebhookUrl();
  if (!webhookUrl) {
    logger.info({
      msg: 'Email webhook not configured; email not delivered',
      to: input.to,
      subject: input.subject,
      metadata: input.metadata || {},
    });
    return { delivered: false, mode: 'log' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const bearer = process.env.EMAIL_WEBHOOK_BEARER_TOKEN;
  if (bearer && bearer.trim()) {
    headers.Authorization = `Bearer ${bearer.trim()}`;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      }),
    });

    if (!response.ok) {
      const error = `EMAIL_WEBHOOK_HTTP_${response.status}`;
      logger.error({ msg: 'Email webhook delivery failed', status: response.status });
      return { delivered: false, mode: 'webhook', error };
    }

    return { delivered: true, mode: 'webhook' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ msg: 'Email webhook delivery error', error: message });
    return { delivered: false, mode: 'webhook', error: message };
  }
}
