import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORG_ID = process.argv[2];
if (!ORG_ID) {
  console.error("Uso: npx tsx scripts/rescue-orphan-conversations.ts <organizationId>");
  process.exit(1);
}

async function rescue(orgId: string) {
  const ownerUser = await prisma.user.findFirst({
    where: { organizationId: orgId, role: "owner" },
  });
  if (!ownerUser) {
    console.error("Nenhum owner encontrado para organizationId:", orgId);
    return;
  }

  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organizationId: orgId, userId: ownerUser.id },
  });
  const connectionId = connection?.id;
  if (!connectionId) {
    console.error("Nenhuma conexão WhatsApp encontrada para o owner");
    return;
  }

  const orphans = await prisma.conversation.findMany({
    where: { contact: { organizationId: orgId }, whatsAppConnectionId: null },
    select: { id: true, contactId: true, status: true, lastMessageAt: true, _count: { select: { messages: true } } },
  });

  console.log(`\n🔍 Encontradas ${orphans.length} conversas órfãs`);
  console.log(`📦 Conexão alvo: ${connectionId}`);

  const withMessages = orphans.filter((c) => c._count.messages > 0);
  const empty = orphans.filter((c) => c._count.messages === 0);

  console.log(`📨 Com mensagens: ${withMessages.length}`);
  console.log(`📭 Vazias (pular): ${empty.length}\n`);

  let merged = 0;
  let assigned = 0;
  let errors = 0;

  for (const orphan of withMessages) {
    try {
      const existing = await prisma.conversation.findFirst({
        where: {
          contactId: orphan.contactId,
          whatsAppConnectionId: connectionId,
          status: "OPEN",
        },
        select: { id: true, lastMessageAt: true },
      });

      if (existing) {
        await prisma.message.updateMany({
          where: { conversationId: orphan.id },
          data: { conversationId: existing.id },
        });

        if (orphan.lastMessageAt && (!existing.lastMessageAt || orphan.lastMessageAt > existing.lastMessageAt)) {
          await prisma.conversation.update({
            where: { id: existing.id },
            data: { lastMessageAt: orphan.lastMessageAt },
          });
        }

        await prisma.conversation.update({
          where: { id: orphan.id },
          data: { status: "CLOSED" },
        });

        merged++;
        console.log(`  ✅ Merge: ${orphan.id} → ${existing.id}`);
      } else {
        await prisma.conversation.update({
          where: { id: orphan.id },
          data: { whatsAppConnectionId: connectionId },
        });

        assigned++;
        console.log(`  🔗 Assign: ${orphan.id}`);
      }
    } catch (err) {
      errors++;
      console.error(`  ❌ Erro em ${orphan.id}:`, err);
    }
  }

  console.log(`\n🎯 Resumo:`);
  console.log(`   Mergeadas: ${merged}`);
  console.log(`   Atribuídas: ${assigned}`);
  console.log(`   Erros: ${errors}`);

  await prisma.$disconnect();
}

rescue(ORG_ID).catch((err) => {
  console.error(err);
  process.exit(1);
});
