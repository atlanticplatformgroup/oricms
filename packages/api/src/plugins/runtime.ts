let bootstrapped = false;

export function bootstrapPluginRuntime(): void {
  if (bootstrapped) return;
  bootstrapped = true;
}

export function resetPluginRuntimeForTests(): void {
  bootstrapped = false;
}
