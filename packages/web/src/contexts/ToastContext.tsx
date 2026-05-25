import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { notifications } from '@mantine/notifications';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: { duration?: number }) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function toastColor(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'green';
    case 'error':
      return 'red';
    case 'warning':
      return 'yellow';
    default:
      return 'blue';
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const removeToast = useCallback((id: string) => {
    notifications.hide(id);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', options?: { duration?: number }) => {
      const id = Math.random().toString(36).slice(2, 9);
      const duration = options?.duration ?? (type === 'error' ? 5000 : 3000);

      notifications.show({
        id,
        message,
        color: toastColor(type),
        autoClose: duration,
      });
    },
    [],
  );

  const value = useMemo(() => ({ showToast, removeToast }), [showToast, removeToast]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
