import { PrismaClient } from '@prisma/client';
import { evolution } from '../src/lib/evolution';

const prisma = new PrismaClient();

async function clearData() {
  const email = 'arthur@arcaffo.com.br';
  console.log(`Starting cleanup for user: ${email}...`);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: {
          include: {
            whatsappConnections: true,
          }
        }
      }
    });

    if (!user) {
      console.log(`User ${email} not found.`);
      return;
    }

    const orgId = user.organizationId;
    console.log(`Found organization: ${user.organization.name} (ID: ${orgId})`);

    // 1. Delete WhatsApp Instances from Evolution API
    const connections = user.organization.whatsappConnections;
    for (const conn of connections) {
      if (conn.instanceName && conn.instanceToken && conn.provider === 'EVOLUTION') {
        console.log(`Deleting Evolution API instance: ${conn.instanceName}...`);
        try {
          // Wait to give evolution API time if needed, though deleteInstance should be fast
          await evolution.deleteInstance(conn.instanceName, conn.instanceToken);
          console.log(`Successfully deleted instance ${conn.instanceName} from Evolution API.`);
        } catch (error: any) {
          console.log(`Warning: Failed to delete instance from API (it might already be deleted): ${error.message}`);
        }
      }
    }

    // 2. Clear Database Data
    console.log(`Deleting all WhatsApp Connections for org...`);
    await prisma.whatsAppConnection.deleteMany({ where: { organizationId: orgId } });

    console.log(`Deleting all Contacts (which will cascade delete Conversations, Messages, Analyses)...`);
    const deletedContacts = await prisma.contact.deleteMany({ where: { organizationId: orgId } });
    console.log(`Deleted ${deletedContacts.count} contacts.`);

    console.log(`Deleting all Tasks for the user...`);
    const deletedTasks = await prisma.task.deleteMany({ where: { userId: user.id } });
    console.log(`Deleted ${deletedTasks.count} tasks.`);

    console.log(`✅ Cleanup completed successfully! System is fresh for ${email}.`);
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearData();
