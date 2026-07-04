import { google } from 'googleapis';
import prisma from './prisma';

const getOAuth2Client = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google/callback';

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

export async function sendEmailViaGmail(
  userId: string,
  to: string,
  subject: string,
  html: string,
  text: string = ''
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleAccessToken: true, googleRefreshToken: true, email: true, name: true },
  });

  if (!user || !user.googleAccessToken) {
    throw new Error('Usuário não possui conta Google conectada para envio de e-mails.');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Criar o e-mail no padrão RFC 2822
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const fromName = user.name ? `=?utf-8?B?${Buffer.from(user.name).toString('base64')}?=` : '';
  const fromEmail = user.email || 'crm@arcaffo.com.br';
  const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const messageParts = [
    `To: ${to}`,
    `From: ${fromHeader}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
  ];

  const message = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });
    return res.data;
  } catch (error) {
    console.error('Erro ao enviar e-mail via Gmail API:', error);
    throw error;
  }
}
