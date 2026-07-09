import { google } from 'googleapis';
import { randomUUID } from 'crypto';
import prisma from './prisma';

export class GoogleCalendarError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, options?: { status?: number; code?: string; cause?: unknown }) {
    super(message);
    this.name = 'GoogleCalendarError';
    this.status = options?.status;
    this.code = options?.code;
    this.cause = options?.cause;
  }
}

function getGoogleApiErrorDetails(error: unknown) {
  const err = error as any;
  const status = err?.response?.status || err?.code;
  const apiError = err?.response?.data?.error;
  const message = apiError?.message
    || err?.response?.data?.error_description
    || err?.errors?.[0]?.message
    || err?.message
    || 'Erro desconhecido no Google Agenda.';
  const code = apiError?.status || apiError?.code || err?.code;

  if (status === 401) {
    return {
      status,
      code,
      message: 'A conexão com o Google Agenda expirou ou foi revogada. Reconecte o Google Agenda nas configurações.',
    };
  }

  if (status === 403) {
    return {
      status,
      code,
      message: 'O Google Agenda recusou a criação do evento. Verifique permissões da conta conectada.',
    };
  }

  return { status, code, message };
}

const getOAuth2Client = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google/callback';

  if (!clientId || !clientSecret) {
    throw new GoogleCalendarError('Google Agenda não está configurado no servidor.', { code: 'GOOGLE_CONFIG_MISSING' });
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

export const getGoogleOAuthUrl = (userId: string) => {
  const oauth2Client = getOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/gmail.send',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: userId, // Pass userId as state to identify user on callback
    prompt: 'consent', // Force consent to ensure we get a refresh token
  });
};

export const exchangeGoogleCodeForTokens = async (code: string, userId: string) => {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token || undefined,
      googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });

  return tokens;
};

export const createCalendarEvent = async (params: {
  userId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  attendeeEmail?: string;
  description?: string;
  location?: string;
  isOnline: boolean;
  timeZone?: string;
  requestId?: string;
}) => {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
  });

  if (!user || !user.googleAccessToken) {
    throw new GoogleCalendarError('O closer selecionado não conectou o Google Agenda.', { code: 'GOOGLE_NOT_CONNECTED' });
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
    expiry_date: user.googleTokenExpiry?.getTime(),
  });

  // Handle token refresh automatically
  oauth2Client.on('tokens', async (tokens) => {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleAccessToken: tokens.access_token,
        ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
        ...(tokens.expiry_date ? { googleTokenExpiry: new Date(tokens.expiry_date) } : {}),
      },
    });
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const event: any = {
    summary: params.title,
    description: params.description,
    start: {
      dateTime: params.startAt.toISOString(),
      timeZone: params.timeZone || 'America/Sao_Paulo',
    },
    end: {
      dateTime: params.endAt.toISOString(),
      timeZone: params.timeZone || 'America/Sao_Paulo',
    },
  };

  if (params.location) {
    event.location = params.location;
  }

  if (params.attendeeEmail) {
    event.attendees = [{ email: params.attendeeEmail }];
  }

  if (params.isOnline) {
    event.conferenceData = {
      createRequest: {
        requestId: params.requestId || `meet-${randomUUID()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  try {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: params.isOnline ? 1 : 0,
      sendUpdates: params.attendeeEmail ? 'all' : 'none',
    });

    const eventId = res.data.id;
    if (!eventId) {
      throw new GoogleCalendarError('Google Agenda criou uma resposta sem ID de evento.', { code: 'GOOGLE_EVENT_ID_MISSING' });
    }

    return {
      eventId,
      meetLink: res.data.hangoutLink,
      htmlLink: res.data.htmlLink,
    };
  } catch (error) {
    console.error('Erro ao criar evento no Google Calendar:', error);
    if (error instanceof GoogleCalendarError) {
      throw error;
    }
    const details = getGoogleApiErrorDetails(error);
    throw new GoogleCalendarError(details.message, { status: details.status, code: details.code, cause: error });
  }
};

export const deleteCalendarEvent = async (userId: string, eventId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.googleAccessToken) {
    return;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
    expiry_date: user.googleTokenExpiry?.getTime(),
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all',
    });
  } catch (error) {
    console.error('Erro ao deletar evento no Google Calendar:', error);
  }
};
