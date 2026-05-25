import { useEffect, useMemo, useState } from 'react';
import { Center, Loader, MantineProvider, Stack, Text } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import '@mantine/tiptap/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { ToastProvider } from './contexts/ToastContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { ORICMS_THEME_CHANGE_EVENT } from './contexts/DarkModeContext';
import { I18nProvider } from './contexts/I18nContext';
import { useAuth } from './contexts/useAuth';
import { useI18n } from './contexts/useI18n';
import { LoginPage } from './components/auth/LoginPage';
import { InstanceSetup } from './components/onboarding/InstanceSetup';
import { initializeWorkspaceExtensions } from './lib/workspace/registry';
import { createAppCssVariablesResolver, createAppTheme, DEFAULT_APP_THEME_PACK, getAppThemeColorScheme, type AppThemePackName } from './lib/theme';
import App from './App';

function AppContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const [systemStatus, setSystemStatus] = useState<{ needsSetup: boolean; hasOwner: boolean; hasProjects: boolean }>({
    needsSetup: false,
    hasOwner: true,
    hasProjects: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1200);

    fetch('/api/v1/system/status', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`System status request failed: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          setSystemStatus(data.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  if (authLoading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="xs">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            {t('common.loading')}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (systemStatus.needsSetup) {
    return (
      <InstanceSetup
        hasOwner={systemStatus.hasOwner}
        onComplete={() => setSystemStatus({ needsSetup: false, hasOwner: true, hasProjects: true })}
      />
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <UserPreferencesProvider>
      <DarkModeProvider>
        <ProjectProvider>
          <App />
        </ProjectProvider>
      </DarkModeProvider>
    </UserPreferencesProvider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

initializeWorkspaceExtensions();

const USER_PREFERENCES_STORAGE_KEY = 'oricms-user-preferences-v1';

function getPreferredThemePack(): AppThemePackName {
  try {
    const storedPreferences = localStorage.getItem(USER_PREFERENCES_STORAGE_KEY);
    if (storedPreferences) {
      const theme = JSON.parse(storedPreferences)?.theme;
      if (theme === 'dark') return 'dark';
      if (theme === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch {
    // Fall back to the product default.
  }

  return DEFAULT_APP_THEME_PACK;
}

export function AppWrapper() {
  const [themePackName, setThemePackName] = useState<AppThemePackName>(getPreferredThemePack);
  const appTheme = useMemo(() => createAppTheme(themePackName), [themePackName]);
  const appCssVariablesResolver = useMemo(() => createAppCssVariablesResolver(themePackName), [themePackName]);
  const appColorScheme = getAppThemeColorScheme(themePackName);

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ isDarkMode?: boolean }>).detail;
      setThemePackName(detail?.isDarkMode ? 'dark' : 'light');
    };

    window.addEventListener(ORICMS_THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(ORICMS_THEME_CHANGE_EVENT, handleThemeChange);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider
        theme={appTheme}
        cssVariablesResolver={appCssVariablesResolver}
        defaultColorScheme={appColorScheme}
        forceColorScheme={appColorScheme}
      >
        <Notifications position="top-right" />
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </MantineProvider>
      <ReactQueryDevtools initialIsOpen={false} position="bottom" />
    </QueryClientProvider>
  );
}

export default AppWrapper;
