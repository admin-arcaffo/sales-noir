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

export async function isBypassUser(email: string, clerkUser: any): Promise<boolean> {
  const adminEmails = ['admin@arcaffo.com', 'arthurfava@gmail.com', 'arthur@arcaffo.com.br'];
  if (adminEmails.includes(email.toLowerCase().trim())) {
    return true;
  }
  const publicMetadata = clerkUser?.publicMetadata as { planOverride?: string; role?: string } | undefined;
  if (publicMetadata?.planOverride === 'unlimited' || publicMetadata?.role === 'admin') {
    return true;
  }
  return false;
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
    try {
      const clerkUser = await currentUser();
      const clerkEmail = clerkUser?.emailAddresses[0]?.emailAddress || null;
      const clerkFullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim();
      const clerkName = clerkFullName || clerkUser?.username || null;

      if ((clerkEmail && clerkEmail !== existingUser.email) || (clerkName && clerkName !== existingUser.name)) {
        existingUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            ...(clerkEmail ? { email: clerkEmail } : {}),
            ...(clerkName ? { name: clerkName } : {}),
          },
          include: { organization: true },
        });
      }
    } catch (error) {
      console.warn('Failed to sync Clerk user profile:', error);
    }

    const email = existingUser.email;
    const pendingPayment = await prisma.pendingPayment.findUnique({
      where: { email },
    });

    if (pendingPayment && pendingPayment.paid) {
      const planDurationDays = pendingPayment.plan === "anual" ? 365 : 30;
      const currentExpires = existingUser.organization.subscriptionExpiresAt;
      const baseDate = (currentExpires && new Date(currentExpires) > new Date()) ? new Date(currentExpires) : new Date();
      const subscriptionExpiresAt = new Date(baseDate.getTime() + planDurationDays * 24 * 60 * 60 * 1000);

      await prisma.organization.update({
        where: { id: existingUser.organizationId },
        data: { 
          plan: pendingPayment.plan,
          subscriptionExpiresAt,
        },
      });
      await prisma.pendingPayment.delete({
        where: { id: pendingPayment.id },
      });
      const updatedUser = await prisma.user.findUnique({
        where: { id: existingUser.id },
        include: { organization: true },
      });
      if (updatedUser) {
        return updatedUser;
      }
    }
    return existingUser;
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress || `${session.userId}@local`;

  existingUser = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });

  if (existingUser) {
    const pendingPayment = await prisma.pendingPayment.findUnique({
      where: { email },
    });

    const updateData: any = { clerkId: session.userId };
    
    if (pendingPayment && pendingPayment.paid) {
      const planDurationDays = pendingPayment.plan === "anual" ? 365 : 30;
      const currentExpires = existingUser.organization.subscriptionExpiresAt;
      const baseDate = (currentExpires && new Date(currentExpires) > new Date()) ? new Date(currentExpires) : new Date();
      const subscriptionExpiresAt = new Date(baseDate.getTime() + planDurationDays * 24 * 60 * 60 * 1000);

      await prisma.organization.update({
        where: { id: existingUser.organizationId },
        data: { 
          plan: pendingPayment.plan,
          subscriptionExpiresAt,
        },
      });
      await prisma.pendingPayment.delete({
        where: { id: pendingPayment.id },
      });
    }

    return prisma.user.update({
      where: { id: existingUser.id },
      data: updateData,
      include: { organization: true },
    });
  }

  const fullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim();
  const displayName = fullName || clerkUser?.username || email.split('@')[0];
  const baseSlug = slugify(displayName || email.split('@')[0] || 'workspace') || 'workspace';
  const uniqueId = session.userId.replace('user_', '');
  const orgSlug = `${baseSlug}-${uniqueId.slice(0, 8)}`;

  const pendingPayment = await prisma.pendingPayment.findUnique({
    where: { email },
  });

  const chosenPlan = pendingPayment && pendingPayment.paid ? pendingPayment.plan : "free";
  let subscriptionExpiresAt: Date | null = null;
  if (pendingPayment && pendingPayment.paid) {
    const planDurationDays = pendingPayment.plan === "anual" ? 365 : 30;
    subscriptionExpiresAt = new Date(Date.now() + planDurationDays * 24 * 60 * 60 * 1000);
    await prisma.pendingPayment.delete({
      where: { id: pendingPayment.id },
    });
  }

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
          plan: chosenPlan,
          subscriptionExpiresAt,
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

export async function checkSubscriptionStatus(existingWorkspace?: any) {
  const workspace = existingWorkspace || await getCurrentWorkspace();
  const email = workspace.email;

  // Membros convidados nunca devem ser cobrados — o owner é responsável pelo plano
  if (workspace.role === 'member') {
    return {
      status: 'active' as const,
      isBypass: true,
      daysRemaining: 999,
      expiresAt: null,
      workspace,
    };
  }

  const adminEmails = ['admin@arcaffo.com', 'arthurfava@gmail.com', 'arthur@arcaffo.com.br'];
  if (adminEmails.includes(email.toLowerCase().trim())) {
    return {
      status: 'active' as const,
      isBypass: true,
      daysRemaining: 999,
      expiresAt: null,
      workspace,
    };
  }

  const session = await auth();
  const publicMetadata = session.sessionClaims?.publicMetadata as { planOverride?: string; role?: string } | undefined;
  if (publicMetadata?.planOverride === 'unlimited' || publicMetadata?.role === 'admin') {
    return {
      status: 'active' as const,
      isBypass: true,
      daysRemaining: 999,
      expiresAt: null,
      workspace,
    };
  }

  if (workspace.organization.plan !== 'free') {
    const expiresAt = workspace.organization.subscriptionExpiresAt;
    if (!expiresAt) {
      return {
        status: 'active' as const,
        isBypass: false,
        daysRemaining: 999,
        expiresAt: null,
        workspace,
      };
    }

    const now = new Date();
    const expiresDate = new Date(expiresAt);
    const diffMs = expiresDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const gracePeriodMs = 5 * 24 * 60 * 60 * 1000;
    const isExpired = now.getTime() > expiresDate.getTime() + gracePeriodMs;

    if (!isExpired) {
      return {
        status: 'active' as const,
        isBypass: false,
        daysRemaining,
        expiresAt: expiresDate,
        workspace,
      };
    }
  }

  if (workspace.organization.plan === 'free') {
    return {
      status: 'unpaid' as const,
      isBypass: false,
      daysRemaining: 0,
      expiresAt: null,
      workspace,
    };
  }

  const expiresAt = workspace.organization.subscriptionExpiresAt;
  const expiresDate = expiresAt ? new Date(expiresAt) : new Date();
  const diffMs = expiresDate.getTime() - Date.now();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return {
    status: 'expired' as const,
    isBypass: false,
    daysRemaining,
    expiresAt: expiresDate,
    workspace,
  };
}

export async function ensurePaidWorkspace() {
  const subStatus = await checkSubscriptionStatus();
  if (subStatus.status === 'unpaid' || subStatus.status === 'expired') {
    throw new Error('Upgrade required');
  }
  return subStatus.workspace;
}
