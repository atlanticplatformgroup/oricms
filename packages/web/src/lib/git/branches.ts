export function getBranchEnvironmentLabel(
  branch: string | undefined,
  mappings: Array<{ branchPattern: string; environmentId?: string | null }>,
): string | null {
  if (!branch) return null;

  const match = mappings.find((mapping) => {
    if (!mapping.branchPattern.includes('*')) {
      return mapping.branchPattern === branch;
    }

    const escaped = mapping.branchPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(branch);
  });

  return match?.environmentId ?? null;
}
