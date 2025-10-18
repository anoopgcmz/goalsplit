import { z, type ZodIssue } from 'zod';

type RawEnv = NodeJS.ProcessEnv;

const smtpEnvKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] as const;

const envSchema = z
  .object({
    MONGODB_URI: z
      .string({ required_error: 'MONGODB_URI is required' })
      .url('MONGODB_URI must be a valid MongoDB connection string'),
    MONGODB_DB: z
      .string({ required_error: 'MONGODB_DB is required' })
      .min(1, 'MONGODB_DB cannot be empty'),
    JWT_SECRET: z
      .string({ required_error: 'JWT_SECRET is required' })
      .min(32, 'JWT_SECRET must be at least 32 characters'),
    EMAIL_FROM: z
      .string({ required_error: 'EMAIL_FROM is required' })
      .email('EMAIL_FROM must be a valid email address'),
    RESEND_API_KEY: z
      .string()
      .min(1, 'RESEND_API_KEY cannot be empty')
      .optional(),
    SMTP_HOST: z
      .string()
      .min(1, 'SMTP_HOST cannot be empty')
      .optional(),
    SMTP_PORT: z
      .coerce
      .number({ invalid_type_error: 'SMTP_PORT must be a number' })
      .int('SMTP_PORT must be an integer')
      .positive('SMTP_PORT must be greater than zero')
      .optional(),
    SMTP_USER: z
      .string()
      .min(1, 'SMTP_USER cannot be empty')
      .optional(),
    SMTP_PASS: z
      .string()
      .min(1, 'SMTP_PASS cannot be empty')
      .optional(),
  })
  .superRefine((env, ctx) => {
    const hasResend = typeof env.RESEND_API_KEY === 'string' && env.RESEND_API_KEY.trim().length > 0;
    const missingSmtpKeys = smtpEnvKeys.filter((key) => {
      const value = env[key];
      if (key === 'SMTP_PORT') {
        return typeof value !== 'number' || !Number.isFinite(value);
      }
      return typeof value !== 'string' || value.trim().length === 0;
    });

    const hasCompleteSmtp = missingSmtpKeys.length === 0;
    const hasAnySmtp = missingSmtpKeys.length < smtpEnvKeys.length;

    if (hasAnySmtp && !hasCompleteSmtp) {
      missingSmtpKeys.forEach((key) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must be provided when using SMTP credentials`,
        });
      });
    }

    if (!hasResend && !hasCompleteSmtp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message: 'Provide RESEND_API_KEY or a complete set of SMTP credentials',
      });
    }
  });

type EnvShape = z.infer<typeof envSchema>;

export type EmailConfig =
  | {
      provider: 'resend';
      from: string;
      apiKey: string;
    }
  | {
      provider: 'smtp';
      from: string;
      host: string;
      port: number;
      user: string;
      pass: string;
    };

export interface AppConfig {
  database: {
    uri: string;
    name: string;
  };
  auth: {
    jwtSecret: string;
  };
  email: EmailConfig;
}

export class EnvValidationError extends Error {
  public readonly issues: ZodIssue[];

  constructor(issues: ZodIssue[]) {
    super('Invalid environment configuration');
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

const buildConfig = (env: EnvShape): AppConfig => {
  if (env.RESEND_API_KEY) {
    return {
      database: {
        uri: env.MONGODB_URI,
        name: env.MONGODB_DB,
      },
      auth: {
        jwtSecret: env.JWT_SECRET,
      },
      email: {
        provider: 'resend',
        from: env.EMAIL_FROM,
        apiKey: env.RESEND_API_KEY,
      },
    };
  }

  return {
    database: {
      uri: env.MONGODB_URI,
      name: env.MONGODB_DB,
    },
    auth: {
      jwtSecret: env.JWT_SECRET,
    },
    email: {
      provider: 'smtp',
      from: env.EMAIL_FROM,
      host: env.SMTP_HOST!,
      port: env.SMTP_PORT!,
      user: env.SMTP_USER!,
      pass: env.SMTP_PASS!,
    },
  };
};

export const loadConfig = (rawEnv: RawEnv = process.env): AppConfig => {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }

  return buildConfig(result.data);
};

export const config = loadConfig();
