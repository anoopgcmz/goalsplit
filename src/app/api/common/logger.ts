import type { Locale } from './schemas';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type StructuredLogParams = {
  level?: LogLevel;
  domain: string;
  code: string;
  status: number;
  locale?: Locale;
  context?: Record<string, unknown>;
  error?: unknown;
};

const selectConsole = (level: LogLevel) => {
  switch (level) {
    case 'debug':
      return console.debug.bind(console);
    case 'info':
      return console.info.bind(console);
    case 'warn':
      return console.warn.bind(console);
    case 'error':
    default:
      return console.error.bind(console);
  }
};

export const logStructuredError = ({
  level = 'error',
  domain,
  code,
  status,
  locale = 'en',
  context = {},
  error,
}: StructuredLogParams) => {
  const base: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    domain,
    code,
    status,
    locale,
    context,
  };

  if (error instanceof Error) {
    base.error = {
      name: error.name,
    };
  } else if (error) {
    base.error = {
      type: typeof error,
    };
  }

  selectConsole(level)(JSON.stringify(base));
};
