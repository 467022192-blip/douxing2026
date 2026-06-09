import { env } from '../config/env';

type ReportErrorPayload = {
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
};

type EventPayload = Record<string, unknown>;

export const trackEvent = (name: string, payload: EventPayload = {}) => {
  if (env.isDev) {
    console.info(`[event] ${name}`, payload);
    return;
  }

  if (env.sentryDsn) {
    import('@sentry/react')
      .then((Sentry) => {
        Sentry.addBreadcrumb({
          category: 'guide',
          level: 'info',
          message: name,
          data: payload
        });
      })
      .catch(() => {
      });
  }
};

export const initMonitoring = () => {
  if (env.sentryDsn) {
    import('@sentry/react')
      .then((Sentry) => {
        Sentry.init({
          dsn: env.sentryDsn,
          tracesSampleRate: 0
        });
      })
      .catch(() => {
      });
  }

  const report = (payload: ReportErrorPayload) => {
    if (env.isDev) {
      console.error('[client-error]', payload);
    }
  };

  window.addEventListener('error', (event) => {
    report({
      message: event.message || 'Unhandled error',
      stack: (event.error as Error | undefined)?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as unknown;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    report({ message, stack, url: window.location.href, userAgent: navigator.userAgent });
  });
};
