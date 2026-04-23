# Sales Noir

CRM comercial com inbox de WhatsApp, análise por IA, tarefas e gestão multi-workspace em Next.js 16, Clerk, Prisma e PostgreSQL.

## Stack

- Next.js 16
- React 19
- Clerk
- Prisma + PostgreSQL
- OpenAI
- Inngest
- WhatsApp Business Cloud API

## Ambiente local

1. Instale as dependências:

```bash
npm install
```

2. Crie o arquivo `.env` a partir de `.env.example`.

3. Rode a aplicação:

```bash
npm run dev
```

4. Se quiser popular o workspace local:

```bash
npm run db:seed
```

## Variáveis obrigatórias

- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `OPENAI_API_KEY`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

Para deploy serverless na Vercel com Supabase, use no `DATABASE_URL` a connection string do pooler transaction mode na porta `6543` com `pgbouncer=true`.

## Deploy na Vercel

O projeto já está preparado para deploy na Vercel com build padrão de Next.js via `vercel.json`.

### Checklist

1. Importe o projeto na Vercel.
2. Configure as variáveis acima em `Production` e `Preview`.
3. Use chaves live do Clerk em produção (`pk_live_...` e `sk_live_...`).
4. Garanta acesso do build da Vercel ao PostgreSQL.
5. Faça o primeiro deploy.

### O que o build faz

- `npm run build`

### Pós-deploy

1. Adicione o domínio da Vercel no Clerk.
2. Configure o webhook da Meta em `https://SEU_DOMINIO/api/webhook/whatsapp`.
3. Use em `hub.verify_token` o valor de `WHATSAPP_VERIFY_TOKEN`.
4. Aponte o Inngest para `https://SEU_DOMINIO/api/inngest`.

## Validação local de produção

```bash
npm run db:migrate:deploy
npm run build
```

## Migrações Prisma

Para esta stack com Supabase + Vercel, rode migrações a partir de um ambiente com acesso ao host direto ou session pooler do banco. O runtime da Vercel deve usar a URL pooler/transaction (`6543`) para atender o app em produção.
