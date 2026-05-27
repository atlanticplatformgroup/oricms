import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Container,
  Grid,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  ArrowRightOnRectangleIcon,
  ComputerDesktopIcon,
  InformationCircleIcon,
  LinkIcon,
  LockClosedIcon,
  RocketLaunchIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/useAuth';
import { ApiError } from '../../lib/api/core';
import { authApi } from '../../lib/api/auth';
import { projectsApi } from '../../lib/api/projects';
import { useToast } from '../../contexts/ToastContext';

interface InstanceSetupProps {
  hasOwner: boolean;
  onComplete: () => void;
}

export function InstanceSetup({ hasOwner, onComplete }: InstanceSetupProps) {
  const { login, isAuthenticated, logout } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<'welcome' | 'owner' | 'project'>(() => {
    if (isAuthenticated) return 'project';
    return 'welcome';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(hasOwner);
  const [setupMode, setSetupMode] = useState<'express' | 'advanced'>('express');

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [ownerData, setOwnerData] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [projectData, setProjectData] = useState({
    name: 'My First Project',
    slug: 'my-first-project',
    repoUrl: '',
  });

  useEffect(() => {
    if (hasOwner && !isAuthenticated) {
      setShowLogin(true);
    }
  }, [hasOwner, isAuthenticated]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const withFallbackSlug = (value: string, fallbackName: string) => {
    const fromValue = generateSlug(value);
    if (fromValue.length >= 2) return fromValue;
    const fromFallback = generateSlug(fallbackName);
    if (fromFallback.length >= 2) return fromFallback;
    return `project-${Date.now().toString().slice(-6)}`;
  };

  const appendUniqueSuffix = (slug: string) => {
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${slug}-${suffix}`;
  };

  const handleCreateOwner = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const fullName = `${ownerData.firstName.trim()} ${ownerData.lastName.trim()}`.trim();
      await authApi.register(ownerData.email, fullName, ownerData.password);
      await login(ownerData.email, ownerData.password);
      setStep('project');
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('already taken') || err.message?.toLowerCase().includes('exists')) {
        setError('An account with this email already exists. Please sign in to continue.');
        setShowLogin(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create owner account');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(loginData.email, loginData.password);
      setStep('project');
    } catch {
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const repoUrl = setupMode === 'express' ? undefined : projectData.repoUrl;
      const baseSlug =
        setupMode === 'express'
          ? withFallbackSlug(projectData.name, 'project')
          : withFallbackSlug(projectData.slug, projectData.name);

      let slugCandidate = baseSlug;
      let created = false;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await projectsApi.create({
            name: projectData.name.trim() || 'Untitled Project',
            slug: slugCandidate,
            repoUrl: repoUrl || undefined,
          });
          created = true;
          break;
        } catch (err) {
          if (err instanceof ApiError && err.code === 'SLUG_EXISTS' && attempt === 0) {
            slugCandidate = appendUniqueSuffix(baseSlug);
            continue;
          }
          throw err;
        }
      }

      if (!created) throw new Error('Failed to create project');

      showToast('Instance initialized successfully!', 'success');
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsLoading(false);
    }
  };

  const renderError = () =>
    error ? (
      <Alert color="red" icon={<InformationCircleIcon width={16} height={16} />} title="Setup issue">
        {error}
      </Alert>
    ) : null;

  if (step === 'welcome') {
    return (
      <Container size="sm" py="xl">
        <Stack gap="xl" align="center">
          <ThemeIcon size={72} radius="xl" variant="light" color="blue">
            <RocketLaunchIcon width={36} height={36} />
          </ThemeIcon>
          <Stack gap={4} align="center">
            <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
              Instance initialization
            </Text>
            <Title order={1}>Welcome to OriCMS</Title>
            <Text c="dimmed" ta="center" maw={560}>
              {hasOwner
                ? "Your account is ready. Finish initializing the instance and launch the dashboard."
                : 'Initialize the system owner account and create the first project.'}
            </Text>
          </Stack>
          <Paper withBorder p="lg" w="100%">
            <Stack gap="md">
              <Text fw={600}>Initialization sequence</Text>
              <Group gap="sm" wrap="nowrap">
                <Badge color={hasOwner ? 'green' : 'blue'} variant={hasOwner ? 'filled' : 'light'}>
                  {hasOwner ? 'Done' : 'Step 1'}
                </Badge>
                <Text size="sm">{hasOwner ? 'Owner account created' : 'Create the system owner account'}</Text>
              </Group>
              <Group gap="sm" wrap="nowrap">
                <Badge variant="light">Step 2</Badge>
                <Text size="sm">Initialize your first project</Text>
              </Group>
              <Group gap="sm" wrap="nowrap">
                <Badge variant="light" color="gray">Step 3</Badge>
                <Text size="sm" c="dimmed">Launch the dashboard</Text>
              </Group>
            </Stack>
          </Paper>
          <Button onClick={() => setStep('owner')}>{hasOwner ? 'Finish setup' : 'Begin initialization'}</Button>
        </Stack>
      </Container>
    );
  }

  if (step === 'owner') {
    return (
      <Container size="xs" py="xl">
        <Paper withBorder p="xl">
          <Stack gap="lg">
            <Stack gap="xs" align="center">
              <ThemeIcon size={56} radius="xl" variant="light" color="blue">
                <LockClosedIcon width={28} height={28} />
              </ThemeIcon>
              <Title order={3}>{showLogin ? 'Sign in' : 'System owner'}</Title>
              <Text c="dimmed" ta="center">
                {showLogin
                  ? 'Sign in to the existing owner account to continue setup.'
                  : 'Create the primary administrative account for this instance.'}
              </Text>
            </Stack>

            {renderError()}

            {showLogin ? (
              <form onSubmit={handleLogin}>
                <Stack gap="md">
                  <TextInput
                    label="Email address"
                    type="email"
                    required
                    value={loginData.email}
                    onChange={(event) => {
                      const email = event.currentTarget.value;
                      setLoginData((prev) => ({ ...prev, email }));
                    }}
                    placeholder="admin@example.com"
                  />
                  <PasswordInput
                    label="Password"
                    required
                    value={loginData.password}
                    onChange={(event) => {
                      const password = event.currentTarget.value;
                      setLoginData((prev) => ({ ...prev, password }));
                    }}
                    placeholder="••••••••"
                  />
                  <Button type="submit" disabled={isLoading} leftSection={isLoading ? <Loader size="xs" /> : <ArrowRightOnRectangleIcon width={16} height={16} />}>
                    Sign in and continue
                  </Button>
                  {!hasOwner ? (
                    <Button variant="subtle" color="gray" onClick={() => { setShowLogin(false); setError(null); }}>
                      Back to registration
                    </Button>
                  ) : null}
                </Stack>
              </form>
            ) : (
              <form onSubmit={handleCreateOwner}>
                <Stack gap="md">
                  <Grid>
                    <Grid.Col span={6}>
                      <TextInput
                        label="First name"
                        required
                        value={ownerData.firstName}
                        onChange={(event) => {
                          const firstName = event.currentTarget.value;
                          setOwnerData((prev) => ({ ...prev, firstName }));
                        }}
                        placeholder="Jane"
                      />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <TextInput
                        label="Last name"
                        required
                        value={ownerData.lastName}
                        onChange={(event) => {
                          const lastName = event.currentTarget.value;
                          setOwnerData((prev) => ({ ...prev, lastName }));
                        }}
                        placeholder="Doe"
                      />
                    </Grid.Col>
                  </Grid>
                  <TextInput
                    label="Email address"
                    type="email"
                    required
                    value={ownerData.email}
                    onChange={(event) => {
                      const email = event.currentTarget.value;
                      setOwnerData((prev) => ({ ...prev, email }));
                    }}
                    placeholder="admin@example.com"
                  />
                  <PasswordInput
                    label="Secure password"
                    required
                    minLength={8}
                    value={ownerData.password}
                    onChange={(event) => {
                      const password = event.currentTarget.value;
                      setOwnerData((prev) => ({ ...prev, password }));
                    }}
                    placeholder="••••••••"
                  />
                  <Button type="submit" disabled={isLoading} leftSection={isLoading ? <Loader size="xs" /> : undefined}>
                    Create owner account
                  </Button>
                  <Button variant="subtle" color="gray" onClick={() => { setShowLogin(true); setError(null); }}>
                    Already have an account? Sign in
                  </Button>
                </Stack>
              </form>
            )}
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="xs" py="xl">
      <Paper withBorder p="xl">
        <Stack gap="lg">
          <Stack gap="xs" align="center">
            <ThemeIcon size={56} radius="xl" variant="light" color="blue">
              <SparklesIcon width={28} height={28} />
            </ThemeIcon>
            <Title order={3}>Setup your first project</Title>
            <Text c="dimmed" ta="center">Choose how OriCMS should manage content for this project.</Text>
          </Stack>

          {renderError()}

          <form onSubmit={handleCreateProject}>
            <Stack gap="lg">
              <Tabs value={setupMode} onChange={(value) => setSetupMode((value as 'express' | 'advanced') || 'express')}>
                <Tabs.List grow>
                  <Tabs.Tab value="express" leftSection={<ComputerDesktopIcon width={16} height={16} />}>Express</Tabs.Tab>
                  <Tabs.Tab value="advanced" leftSection={<LinkIcon width={16} height={16} />}>Advanced</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="express" pt="md">
                  <Stack gap="md">
                    <Alert color="blue" icon={<InformationCircleIcon width={16} height={16} />} title="Managed storage">
                      We&apos;ll initialize a local Git repository on this server. You can connect it to GitHub later.
                    </Alert>
                    <TextInput
                      label="Project name"
                      required={setupMode === 'express'}
                      value={projectData.name}
                      onChange={(event) => {
                        const name = event.currentTarget.value;
                        setProjectData((prev) => ({
                          ...prev,
                          name,
                          slug: generateSlug(name),
                        }));
                      }}
                      placeholder="My Awesome Project"
                    />
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="advanced" pt="md">
                  <Stack gap="md">
                    <TextInput
                      label="Project name"
                      required={setupMode === 'advanced'}
                      value={projectData.name}
                      onChange={(event) => {
                        const name = event.currentTarget.value;
                        setProjectData((prev) => ({ ...prev, name }));
                      }}
                    />
                    <TextInput
                      label="URL slug"
                      required={setupMode === 'advanced'}
                      value={projectData.slug}
                      onChange={(event) => {
                        const slug = event.currentTarget.value;
                        setProjectData((prev) => ({ ...prev, slug }));
                      }}
                    />
                    <TextInput
                      label="Git repository URL"
                      type="url"
                      required={setupMode === 'advanced'}
                      value={projectData.repoUrl}
                      onChange={(event) => {
                        const repoUrl = event.currentTarget.value;
                        setProjectData((prev) => ({ ...prev, repoUrl }));
                      }}
                      placeholder="https://github.com/username/repo"
                    />
                  </Stack>
                </Tabs.Panel>
              </Tabs>

              <Button type="submit" disabled={isLoading} leftSection={isLoading ? <Loader size="xs" /> : undefined}>
                {setupMode === 'express' ? 'Launch managed project' : 'Connect and initialize'}
              </Button>

              <Button
                variant="subtle"
                color="gray"
                onClick={() => {
                  void logout();
                  setStep('welcome');
                }}
              >
                Sign out and reset
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  );
}
