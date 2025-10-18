import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';

import { logStructuredError } from '../common/logger';
import { dbConnect } from '@/lib/mongo';
import { AnalyticsEventModel } from '@/models';

const primitiveSchema = z.union([
  z.string().max(256),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const propertiesSchema = z.record(z.string().min(1).max(64), primitiveSchema);

const analyticsEventSchema = z.object({
  event: z.string().min(1).max(64),
  timestamp: z.string().datetime({ offset: true }).or(z.string().datetime()),
  properties: propertiesSchema.optional(),
});

const analyticsBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(50),
});

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

const sanitizeProperties = (
  properties: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> => {
  if (!properties) {
    return {};
  }

  return Object.entries(properties).reduce<Record<string, string | number | boolean | null>>(
    (accumulator, [key, value]) => {
      const normalized = key.toLowerCase();
      if (SENSITIVE_KEYS.has(normalized)) {
        return accumulator;
      }

      if (typeof value === 'string') {
        if (emailLike.test(value)) {
          return accumulator;
        }
        accumulator[key] = value.slice(0, 256);
        return accumulator;
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        accumulator[key] = value;
        return accumulator;
      }

      if (typeof value === 'boolean') {
        accumulator[key] = value;
        return accumulator;
      }

      if (value === null) {
        accumulator[key] = null;
      }

      return accumulator;
    },
    {},
  );
};

const RETENTION_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

let retentionJobScheduled = false;

const ensureRetentionJob = () => {
  if (retentionJobScheduled) {
    return;
  }

  retentionJobScheduled = true;

  const runCleanup = async () => {
    try {
      await dbConnect();
      const cutoff = new Date(Date.now() - RETENTION_WINDOW_MS);
      await AnalyticsEventModel.deleteMany({ recordedAt: { $lt: cutoff } });
    } catch (error) {
      logStructuredError({
        domain: 'analytics.retention',
        code: 'retention_cleanup_failed',
        status: 500,
        context: {},
        error,
      });
    }
  };

  void runCleanup();

  const interval = setInterval(() => {
    void runCleanup();
  }, 1000 * 60 * 60 * 12);

  if (typeof interval.unref === 'function') {
    interval.unref();
  }
};

export const POST = async (request: Request) => {
  try {
    const payload = await request.json();
    const parsed = analyticsBatchSchema.parse(payload);

    await dbConnect();

    const documents = parsed.events.map((event) => ({
      event: event.event,
      properties: sanitizeProperties(event.properties),
      recordedAt: new Date(event.timestamp),
    }));

    await AnalyticsEventModel.insertMany(documents, { ordered: false });
    ensureRetentionJob();

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid analytics payload', issues: error.issues },
        { status: 400 },
      );
    }

    logStructuredError({
      domain: 'analytics',
      code: 'ingest_failed',
      status: 500,
      context: {},
      error,
    });

    return NextResponse.json({ error: 'Failed to record analytics events' }, { status: 500 });
  }
};
