import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../middleware/logger';
import { dispatchWebhookFailureAlert, type WebhookFailureAlertEvent } from '../alerts';

const baseEvent: WebhookFailureAlertEvent = {
  action: 'environment.revalidate',
  projectId: 'project-1',
  branch: 'main',
  environmentId: 'env-prod',
  endpointHost: 'hooks.example.com',
  attempts: 3,
  maxAttempts: 3,
  timeoutMs: 5000,
  backoffMs: 300,
  durationMs: 8200,
  status: 503,
  error: 'revalidation webhook responded 503',
  errorType: 'http',
};

describe('webhook alert routing', () => {
  afterEach(() => {
    delete process.env.WEBHOOK_ALERTS_ENABLED;
    delete process.env.WEBHOOK_ALERTS_SLACK_WEBHOOK_URL;
    delete process.env.WEBHOOK_ALERTS_PAGERDUTY_ROUTING_KEY;
    delete process.env.WEBHOOK_ALERTS_PAGERDUTY_SEVERITY;
    delete process.env.WEBHOOK_ALERTS_SOURCE;
    vi.restoreAllMocks();
  });

  it('dispatches to Slack and PagerDuty when configured', async () => {
    process.env.WEBHOOK_ALERTS_SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/abc';
    process.env.WEBHOOK_ALERTS_PAGERDUTY_ROUTING_KEY = 'pd-routing-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 202 });

    await dispatchWebhookFailureAlert(baseEvent, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://hooks.slack.test/services/abc');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://events.pagerduty.com/v2/enqueue');
  });

  it('does not dispatch when alerts are explicitly disabled', async () => {
    process.env.WEBHOOK_ALERTS_ENABLED = 'false';
    process.env.WEBHOOK_ALERTS_SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/abc';
    const fetchMock = vi.fn();

    await dispatchWebhookFailureAlert(baseEvent, fetchMock as unknown as typeof fetch);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores non-https slack webhook urls', async () => {
    process.env.WEBHOOK_ALERTS_SLACK_WEBHOOK_URL = 'http://localhost:3000/webhook';
    const fetchMock = vi.fn();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => logger);

    await dispatchWebhookFailureAlert(baseEvent, fetchMock as unknown as typeof fetch);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith({ msg: 'Ignoring invalid webhook alert Slack URL' });
  });
});
