import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

async function ensureWorkspace() {
  const clerkId = process.env.SEED_CLERK_USER_ID || 'seed-owner'
  const email = process.env.SEED_USER_EMAIL || 'owner@salesnoir.local'
  const name = process.env.SEED_USER_NAME || 'Sales Noir Owner'

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ clerkId }, { email }],
    },
    include: { organization: true },
  })

  if (existingUser) {
    return existingUser
  }

  return prisma.user.create({
    data: {
      clerkId,
      email,
      name,
      role: 'owner',
      organization: {
        create: {
          name,
          slug: `${slugify(name) || 'sales-noir'}-seed`,
        },
      },
    },
    include: { organization: true },
  })
}

async function ensurePromptTemplate(organizationId) {
  const existing = await prisma.promptTemplate.findFirst({
    where: {
      organizationId,
      slug: 'analysis-primary',
      isActive: true,
    },
  })

  if (existing) {
    return existing
  }

  return prisma.promptTemplate.create({
    data: {
      organizationId,
      name: 'Prompt de Analise Principal',
      slug: 'analysis-primary',
      category: 'analysis',
      version: 1,
      isActive: true,
      content: `Voce e o SALES NOIR, um copiloto comercial focado em diagnostico de conversas e proximo passo de negociacao.

Regras:
- Baseie-se apenas nos dados observados na conversa.
- Identifique objecoes explicitas e implicitas.
- Gere respostas naturais de WhatsApp.
- Retorne estritamente o JSON esperado.`,
    },
  })
}

async function ensureContactBundle(organizationId, userId, contactSeed) {
  const contact = await prisma.contact.upsert({
    where: {
      phone_organizationId: {
        phone: contactSeed.phone,
        organizationId,
      },
    },
    update: {
      name: contactSeed.name,
      company: contactSeed.company,
      origin: contactSeed.origin,
      notes: contactSeed.notes,
      potentialValue: contactSeed.potentialValue,
    },
    create: {
      organizationId,
      phone: contactSeed.phone,
      name: contactSeed.name,
      company: contactSeed.company,
      origin: contactSeed.origin,
      notes: contactSeed.notes,
      potentialValue: contactSeed.potentialValue,
    },
  })

  let conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id },
    orderBy: { updatedAt: 'desc' },
  })

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        status: 'OPEN',
        stage: contactSeed.stage,
        temperature: contactSeed.temperature,
        lastMessageAt: new Date(),
      },
    })
  }

  const messageCount = await prisma.message.count({
    where: { conversationId: conversation.id },
  })

  if (messageCount === 0) {
    await prisma.message.createMany({
      data: contactSeed.messages.map((message, index) => ({
        conversationId: conversation.id,
        direction: message.direction,
        type: 'TEXT',
        content: message.content,
        timestamp: new Date(Date.now() - (contactSeed.messages.length - index) * 60 * 60 * 1000),
      })),
    })

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
    })
  }

  const existingTask = await prisma.task.findFirst({
    where: {
      userId,
      contactId: contact.id,
      title: contactSeed.task.title,
    },
  })

  if (!existingTask) {
    await prisma.task.create({
      data: {
        userId,
        contactId: contact.id,
        title: contactSeed.task.title,
        type: contactSeed.task.type,
        priority: contactSeed.task.priority,
        dueAt: new Date(Date.now() + contactSeed.task.dueHours * 60 * 60 * 1000),
      },
    })
  }
}

async function main() {
  const user = await ensureWorkspace()
  await ensurePromptTemplate(user.organizationId)

  const contacts = [
    {
      phone: '5511999991001',
      name: 'Roberto Silva',
      company: 'TechCorp',
      origin: 'Indicacao',
      notes: 'Comparando preco com dois fornecedores.',
      potentialValue: 15000,
      stage: 'NEGOCIACAO',
      temperature: 'HOT',
      messages: [
        { direction: 'INBOUND', content: 'Gostei da proposta, mas preciso entender o prazo.' },
        { direction: 'OUTBOUND', content: 'Consigo detalhar o cronograma e o que entregamos em cada etapa.' },
      ],
      task: { title: 'Follow-up de negociacao com Roberto', type: 'FOLLOW_UP', priority: 'HIGH', dueHours: 24 },
    },
    {
      phone: '5511999991002',
      name: 'Marina Mendes',
      company: 'Retail Inc',
      origin: 'Website',
      notes: 'Quer levar a proposta para o financeiro.',
      potentialValue: 8500,
      stage: 'APRESENTACAO_PROPOSTA',
      temperature: 'WARM',
      messages: [
        { direction: 'INBOUND', content: 'Pode me enviar um resumo executivo para apresentar internamente?' },
        { direction: 'OUTBOUND', content: 'Sim, vou estruturar em uma pagina com escopo, prazo e investimento.' },
      ],
      task: { title: 'Enviar resumo executivo para Marina', type: 'PROPOSAL', priority: 'MEDIUM', dueHours: 12 },
    },
    {
      phone: '5511999991003',
      name: 'Carlos Augusto',
      company: 'Logistics BR',
      origin: 'Ads',
      notes: 'Lead esfriou depois da primeira reuniao.',
      potentialValue: 25000,
      stage: 'FOLLOW_UP',
      temperature: 'COLD',
      messages: [
        { direction: 'OUTBOUND', content: 'Queria retomar nossa conversa sobre a operacao comercial.' },
        { direction: 'INBOUND', content: 'Estou reorganizando algumas prioridades e te retorno na proxima semana.' },
      ],
      task: { title: 'Reativar Carlos Augusto', type: 'CALL', priority: 'LOW', dueHours: 72 },
    },
  ]

  for (const contactSeed of contacts) {
    await ensureContactBundle(user.organizationId, user.id, contactSeed)
  }

  console.log(`Workspace seeded for ${user.email}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
