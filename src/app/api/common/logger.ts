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

const SENSITIVE_KEYS = new Set([
  'email',
  'e-mail',
  'phone',
  'telephone',
  'name',
  'full_name',
  'full-name',
  'address',
  'token',
  'session',
  'password',
]);

const emailLike = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const sanitizeValue = (key: string, value: unknown): unknown => {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (accumulator, [nestedKey, nestedValue]) => {
        accumulator[nestedKey] = sanitizeValue(nestedKey, nestedValue);
        return accumulator;
      },
      {},
    );
  }

  if (typeof value === 'string') {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || emailLike.test(value)) {
      return '[redacted]';
    }
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return '[redacted]';
};

const sanitizeContext = (context: Record<string, unknown> | undefined) => {
  if (!context) {
    return {};
  }

  return Object.entries(context).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    accumulator[key] = sanitizeValue(key, value);
    return accumulator;
  }, {});
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
  context,
  error,
}: StructuredLogParams) => {
  if (typeof window !== 'undefined') {
    // Prevent server logs from leaking into client bundles.
    return;
  }

  const base: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    domain,
    code,
    status,
    locale,
    context: sanitizeContext(context),
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
