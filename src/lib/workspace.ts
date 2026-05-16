'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export async function getCurrentWorkspace() {
  const session = await auth();

  if (!session.userId) {
    throw new Error('Unauthorized');
  }

  let existingUser = await prisma.user.findUnique({
    where: { clerkId: session.userId },
    include: { organization: true },
  });

  if (existingUser) {
    return existingUser;
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress || `${session.userId}@local`;

  // Check if user exists by email (happens if they delete and recreate their Clerk account)
  existingUser = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });

  if (existingUser) {
    // Update the existing user with the new clerkId
    return prisma.user.update({
      where: { id: existingUser.id },
      data: { clerkId: session.userId },
      include: { organization: true },
    });
  }

  const fullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim();
  const displayName = fullName || clerkUser?.username || email.split('@')[0];
  const baseSlug = slugify(displayName || email.split('@')[0] || 'workspace') || 'workspace';
  // Use a more unique part of the userId, avoiding the common 'user_' prefix
  const uniqueId = session.userId.replace('user_', '');
  const orgSlug = `${baseSlug}-${uniqueId.slice(0, 8)}`;

  return prisma.user.create({
    data: {
      clerkId: session.userId,
      email,
      name: displayName,
      role: 'owner',
      organization: {
        create: {
          name: displayName,
          slug: orgSlug,
        },
      },
    },
    include: { organization: true },
  });
}

export async function getWhatsAppWorkspaceByPhoneNumberId(phoneNumberId: string) {
  const connection = await prisma.whatsAppConnection.findFirst({
    where: {
      phoneNumberId,
      status: 'CONNECTED',
    },
    include: {
      organization: true,
    },
  });

  if (!connection) {
    throw new Error('WhatsApp connection not configured for this phone number');
  }

  return connection;
}
