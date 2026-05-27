import { describe, expect, it } from 'vitest';
import { getBranchEnvironmentLabel } from '../git/branches';

describe('getBranchEnvironmentLabel', () => {
  it('should return null for undefined branch', () => {
    expect(getBranchEnvironmentLabel(undefined, [])).toBeNull();
  });

  it('should return null when no mappings match', () => {
    const mappings = [{ branchPattern: 'main', environmentId: 'production' }];
    expect(getBranchEnvironmentLabel('feature-x', mappings)).toBeNull();
  });

  it('should match exact branch pattern', () => {
    const mappings = [
      { branchPattern: 'main', environmentId: 'production' },
      { branchPattern: 'develop', environmentId: 'staging' },
    ];
    expect(getBranchEnvironmentLabel('main', mappings)).toBe('production');
    expect(getBranchEnvironmentLabel('develop', mappings)).toBe('staging');
  });

  it('should match wildcard pattern', () => {
    const mappings = [{ branchPattern: 'release/*', environmentId: 'release-env' }];
    expect(getBranchEnvironmentLabel('release/1.0.0', mappings)).toBe('release-env');
    expect(getBranchEnvironmentLabel('release/2.0', mappings)).toBe('release-env');
  });

  it('should not match partial wildcard', () => {
    const mappings = [{ branchPattern: 'release/*', environmentId: 'release-env' }];
    expect(getBranchEnvironmentLabel('release', mappings)).toBeNull();
    expect(getBranchEnvironmentLabel('release/', mappings)).toBe('release-env');
  });

  it('should match first applicable mapping', () => {
    const mappings = [
      { branchPattern: 'main', environmentId: 'production' },
      { branchPattern: '*', environmentId: 'default' },
    ];
    expect(getBranchEnvironmentLabel('main', mappings)).toBe('production');
    expect(getBranchEnvironmentLabel('feature', mappings)).toBe('default');
  });

  it('should return null for null environmentId', () => {
    const mappings = [{ branchPattern: 'main', environmentId: null }];
    expect(getBranchEnvironmentLabel('main', mappings)).toBeNull();
  });

  it('should handle special regex characters in pattern', () => {
    const mappings = [{ branchPattern: 'feature.test', environmentId: 'test-env' }];
    expect(getBranchEnvironmentLabel('feature.test', mappings)).toBe('test-env');
    expect(getBranchEnvironmentLabel('featureXtest', mappings)).toBeNull();
  });
});
