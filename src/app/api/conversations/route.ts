import { NextResponse } from 'next/server';
import { getConversations } from '@/actions/crm';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since') || undefined;

    const result = await getConversations(since);

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
