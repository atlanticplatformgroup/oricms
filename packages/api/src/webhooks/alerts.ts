export type WebhookDispatchAction = 'environment.deploy' | 'environment.revalidate';

import { logger } from '../middleware/logger';

type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface WebhookFailureAlertEvent {
  action: WebhookDispatchAction;
  projectId: string;
  branch: string;
  environmentId: string;
  endpointHost: string | null;
  attempts: number;
  maxAttempts: number;
  timeoutMs: number;
  backoffMs: number;
  durationMs: number;
  status?: number;
  error?: string;
  errorType?: 'timeout' | 'network' | 'http' | 'unknown' | 'policy';
}

interface WebhookAlertConfig {
  enabled: boolean;
  slackWebhookUrl?: string;
  pagerDutyRoutingKey?: string;
  pagerDutySeverity: AlertSeverity;
  source: string;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

function resolveSeverity(value: string | undefined): AlertSeverity {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'info' || normalized === 'warning' || normalized === 'error' || normalized === 'critical') {
    return normalized;
  }
  return 'error';
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveWebhookAlertConfig(): WebhookAlertConfig {
  const slackWebhookUrlRaw = process.env.WEBHOOK_ALERTS_SLACK_WEBHOOK_URL?.trim();
  const slackWebhookUrl = slackWebhookUrlRaw && isHttpsUrl(slackWebhookUrlRaw) ? slackWebhookUrlRaw : undefined;
  const pagerDutyRoutingKey = process.env.WEBHOOK_ALERTS_PAGERDUTY_ROUTING_KEY?.trim();
  const enabled = parseBoolean(process.env.WEBHOOK_ALERTS_ENABLED, true)
    && (Boolean(slackWebhookUrl) || Boolean(pagerDutyRoutingKey));

  if (slackWebhookUrlRaw && !slackWebhookUrl) {
    logger.warn({ msg: 'Ignoring invalid webhook alert Slack URL' });
  }

  return {
    enabled,
    slackWebhookUrl,
    pagerDutyRoutingKey,
    pagerDutySeverity: resolveSeverity(process.env.WEBHOOK_ALERTS_PAGERDUTY_SEVERITY),
    source: process.env.WEBHOOK_ALERTS_SOURCE?.trim() || 'oricms-webhooks',
  };
}

function buildAlertSummary(event: WebhookFailureAlertEvent): string {
  return `Webhook dispatch failed: ${event.action} project=${event.projectId} env=${event.environmentId} branch=${event.branch}`;
}

function buildSlackMessage(event: WebhookFailureAlertEvent): string {
  return [
    ':rotating_light: OriCMS webhook dispatch failure',
    `Action: ${event.action}`,
    `Project: ${event.projectId}`,
    `Environment: ${event.environmentId}`,
    `Branch: ${event.branch}`,
    `Endpoint host: ${event.endpointHost || 'n/a'}`,
    `Attempts: ${event.attempts}/${event.maxAttempts}`,
    `Status: ${typeof event.status === 'number' ? event.status : 'n/a'}`,
    `Error type: ${event.errorType || 'unknown'}`,
    `Error: ${event.error || 'unknown'}`,
    `Duration: ${event.durationMs}ms`,
  ].join('\n');
}

async function sendSlackAlert(
  webhookUrl: string,
  event: WebhookFailureAlertEvent,
  fetchImpl: typeof fetch
): Promise<void> {
  const response = await fetchImpl(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: buildSlackMessage(event),
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack alert webhook responded ${response.status}`);
  }
}

async function sendPagerDutyAlert(
  routingKey: string,
  source: string,
  severity: AlertSeverity,
  event: WebhookFailureAlertEvent,
  fetchImpl: typeof fetch
): Promise<void> {
  const dedupKey = [
    event.projectId,
    event.environmentId,
    event.branch,
    event.action,
    event.errorType || 'unknown',
  ].join(':');

  const response = await fetchImpl('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routing_key: routingKey,
      event_action: 'trigger',
      dedup_key: dedupKey,
      payload: {
        summary: buildAlertSummary(event),
        source,
        severity,
        custom_details: {
          endpointHost: event.endpointHost,
          attempts: event.attempts,
          maxAttempts: event.maxAttempts,
          timeoutMs: event.timeoutMs,
          backoffMs: event.backoffMs,
          durationMs: event.durationMs,
          status: event.status,
          errorType: event.errorType,
          error: event.error,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`PagerDuty alert API responded ${response.status}`);
  }
}

export async function dispatchWebhookFailureAlert(
  event: WebhookFailureAlertEvent,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const config = resolveWebhookAlertConfig();
  if (!config.enabled) return;

  const tasks: Promise<void>[] = [];

  if (config.slackWebhookUrl) {
    tasks.push(sendSlackAlert(config.slackWebhookUrl, event, fetchImpl));
  }

  if (config.pagerDutyRoutingKey) {
    tasks.push(sendPagerDutyAlert(
      config.pagerDutyRoutingKey,
      config.source,
      config.pagerDutySeverity,
      event,
      fetchImpl
    ));
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === 'rejected') {
      logger.warn({ msg: 'Failed to dispatch webhook failure alert', error: result.reason });
    }
  }
}
