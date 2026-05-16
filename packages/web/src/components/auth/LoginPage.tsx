import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert,
  Button,
  Center,
  Divider,
  Group,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useAuth } from '../../contexts/useAuth';
import { useI18n } from '../../contexts/useI18n';
import { useToast } from '../../contexts/ToastContext';
import { authApi } from '../../lib/api/auth';

export function LoginPage() {
  const { login, error, clearError, isLoading } = useAuth();
  const { showToast } = useToast();
  const { locale, setLocale, t } = useI18n();
  const location = useLocation();

  const [mode, setMode] = useState<'login' | 'register'>(
    location.pathname === '/register' ? 'register' : 'login',
  );

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  useEffect(() => {
    if (location.pathname === '/register') {
      setMode('register');
    } else if (location.pathname === '/login') {
      setMode('login');
    }
  }, [location.pathname]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
        return;
      }

      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
      await authApi.register(formData.email, fullName, formData.password);
      showToast('Registration successful. Please sign in.', 'success');
      setMode('login');
    } catch {
      // Auth context displays errors.
    }
  };

  const handleGitHubLogin = () => {
    const clientId = (import.meta as unknown as { env: { VITE_GITHUB_CLIENT_ID: string } }).env.VITE_GITHUB_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = 'repo user:email';

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    window.location.href = githubAuthUrl;
  };

  return (
    <Center h="100vh" p="md">
      <Paper withBorder shadow="sm" p="lg" w={420}>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Title order={3}>{mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}</Title>
            <Select
              size="xs"
              value={locale}
              data={[
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Espanol' },
              ]}
              onChange={(value) => setLocale((value as 'en' | 'es') || 'en')}
            />
          </Group>

          {error && <Alert color="red">{error}</Alert>}

          <Tabs value={mode} onChange={(value) => setMode((value as 'login' | 'register') || 'login')}>
            <Tabs.List grow>
              <Tabs.Tab value="login">{t('auth.signIn')}</Tabs.Tab>
              <Tabs.Tab value="register">{t('auth.createAccount')}</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              {mode === 'register' && (
                <Group grow>
                  <TextInput
                    required
                    label="First Name"
                    value={formData.firstName}
                    onChange={(event) => setFormData((previous) => ({ ...previous, firstName: event.currentTarget.value }))}
                  />
                  <TextInput
                    required
                    label="Last Name"
                    value={formData.lastName}
                    onChange={(event) => setFormData((previous) => ({ ...previous, lastName: event.currentTarget.value }))}
                  />
                </Group>
              )}

              <TextInput
                required
                type="email"
                label={t('auth.emailAddress')}
                value={formData.email}
                onChange={(event) => setFormData((previous) => ({ ...previous, email: event.currentTarget.value }))}
              />

              <PasswordInput
                required
                minLength={8}
                label={t('auth.password')}
                value={formData.password}
                onChange={(event) => setFormData((previous) => ({ ...previous, password: event.currentTarget.value }))}
              />

              {mode === 'register' && (
                <Text size="xs" c="dimmed">
                  {t('auth.passwordHelp')}
                </Text>
              )}

              <Button type="submit" loading={isLoading} fullWidth>
                {mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
              </Button>
            </Stack>
          </form>

          <Divider label={t('auth.or')} labelPosition="center" />

          <Button variant="default" onClick={handleGitHubLogin} fullWidth>
            {t('auth.continueWithGitHub')}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
