import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dbConnect, getConnectionMetrics } from '@/lib/mongo';

const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  readyState: z.number(),
  connectionId: z.string().nullable(),
  connectCount: z.number().int().nonnegative(),
  reusedConnection: z.boolean(),
});

export async function GET() {
  const before = getConnectionMetrics();
  const connection = await dbConnect();
  const after = getConnectionMetrics();

  const payload = HealthResponseSchema.parse({
    status: 'ok',
    readyState: connection.connection.readyState,
    connectionId: connection.connection.id ?? null,
    connectCount: after.connectCount,
    reusedConnection: before.hasConnection && before.connectCount === after.connectCount,
  });

  return NextResponse.json(payload);
}
