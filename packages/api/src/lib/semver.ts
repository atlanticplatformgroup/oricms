interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parseSemver(value: string): ParsedSemver | null {
  const match = value.trim().match(SEMVER_PATTERN);
  if (!match) return null;
  const prerelease = match[4] ? match[4].split('.') : [];
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    prerelease,
  };
}

function comparePrerelease(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const maxLength = Math.max(a.length, b.length);
  for (let index = 0; index < maxLength; index += 1) {
    const left = a[index];
    const right = b[index];

    if (left === undefined) return -1;
    if (right === undefined) return 1;
    if (left === right) continue;

    const leftNumeric = /^\d+$/.test(left);
    const rightNumeric = /^\d+$/.test(right);
    if (leftNumeric && rightNumeric) {
      const leftValue = Number.parseInt(left, 10);
      const rightValue = Number.parseInt(right, 10);
      if (leftValue > rightValue) return 1;
      if (leftValue < rightValue) return -1;
      continue;
    }

    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return left.localeCompare(right);
  }

  return 0;
}

export function compareSemverSafe(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);

  if (!left && !right) return a.localeCompare(b);
  if (!left) return -1;
  if (!right) return 1;

  if (left.major !== right.major) return left.major > right.major ? 1 : -1;
  if (left.minor !== right.minor) return left.minor > right.minor ? 1 : -1;
  if (left.patch !== right.patch) return left.patch > right.patch ? 1 : -1;

  return comparePrerelease(left.prerelease, right.prerelease);
}
