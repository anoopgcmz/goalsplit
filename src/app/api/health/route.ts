import { NextResponse } from 'next/server';

import { dbConnect, getConnectionMetrics } from '@/lib/mongo';

export async function GET() {
  const before = getConnectionMetrics();
  const connection = await dbConnect();
  const after = getConnectionMetrics();

  return NextResponse.json({
    status: 'ok',
    readyState: connection.connection.readyState,
    connectionId: connection.connection.id ?? null,
    connectCount: after.connectCount,
    reusedConnection: before.hasConnection && before.connectCount === after.connectCount,
  });
}
