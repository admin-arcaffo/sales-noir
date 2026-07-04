import { NextResponse } from 'next/server';
import { exchangeGoogleCodeForTokens } from '@/lib/google-calendar';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('state'); // We passed userId in state
  const error = searchParams.get('error');

  if (error) {
    console.error('Erro na autenticação do Google:', error);
    return NextResponse.redirect(new URL('/settings?error=google_auth_failed', request.url));
  }

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/settings?error=missing_code', request.url));
  }

  try {
    await exchangeGoogleCodeForTokens(code, userId);
    return NextResponse.redirect(new URL('/settings?success=google_connected', request.url));
  } catch (err: any) {
    console.error('Falha ao trocar código do Google por token:', err.message);
    return NextResponse.redirect(new URL('/settings?error=google_token_exchange_failed', request.url));
  }
}
