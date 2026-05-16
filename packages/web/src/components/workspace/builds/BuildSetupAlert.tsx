import { Alert } from '@mantine/core';

export function BuildSetupAlert({
  projectLoading,
  projectError,
  hasEnvironments,
  hasBuildWebhooks,
}: {
  projectLoading: boolean;
  projectError: boolean;
  hasEnvironments: boolean;
  hasBuildWebhooks: boolean;
}) {
  if (projectLoading || projectError) return null;
  if (!hasEnvironments) {
    return (
      <Alert color="orange" title="Environment setup needed">
        Configure at least one environment in Settings before relying on build and deployment workflows.
      </Alert>
    );
  }
  if (!hasBuildWebhooks) {
    return (
      <Alert color="yellow" title="Deploy automation is not configured">
        Builds can be triggered manually, but no environment build webhook is configured yet.
      </Alert>
    );
  }
  return null;
}
