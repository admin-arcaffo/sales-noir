import { NextResponse } from 'next/server';
import { getConversations } from '@/actions/crm';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since') || undefined;
    const connectionId = searchParams.get('connectionId') || searchParams.get('connection_id') || undefined;
    const conversationId = searchParams.get('conversationId') || searchParams.get('conversation_id') || undefined;
    const scope = searchParams.get('scope') || undefined;
    const assignedToMeParam = searchParams.get('assignedToMe');
    const isFloatingScope = scope === 'floating';
    const isIncremental = Boolean(since);

    const result = await getConversations(since, connectionId, {
      messageLimit: isFloatingScope ? 15 : isIncremental ? 10 : 50,
      includeMediaUrls: !isFloatingScope,
      includeAnalysis: !isFloatingScope,
      includeConnections: !isFloatingScope && !isIncremental,
      runMaintenance: !isFloatingScope && !isIncremental,
      assignedToMe: assignedToMeParam !== null ? assignedToMeParam === 'true' : undefined,
      conversationId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === 'Upgrade required') {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 402 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching conversations API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations', details: error.message },
      { status: 500 }
    );
  }
}
