# Configuração Necessária para as Melhorias

Este documento descreve as mudanças implementadas e o que é necessário para completar a implementação.

## 🔐 Mudanças Implementadas

### FASE 1: Segurança (Completa)

#### 1. Criptografia de Tokens ✅
- **Arquivo criado:** `src/lib/encryption.ts`
- **Função:** Criptografa/descriptografa tokens usando AES-256-GCM
- **Onde usado:** 
  - `src/actions/whatsapp.ts` - encripta `instanceToken` antes de salvar
  - `src/app/api/webhook/evolution/route.ts` - descriptografa antes de usar

#### 2. Verificação de Assinatura em Webhooks ✅
- **Arquivo:** `src/lib/encryption.ts`
- **Funções:** `verifyWebhookSignature()`, `generateWebhookSignature()`
- **Implementado em:** `src/app/api/webhook/evolution/route.ts`
- **Comportamento:** Valida HMAC-SHA256 do webhook

#### 3. Rate Limiting ✅
- **Arquivo:** `src/actions/whatsapp.ts`
- **Limite:** Max 5 tentativas por organização por 24 horas
- **Rastreamento:** `connectionAttempts` e `lastConnectionAttemptAt` no DB

### FASE 2: Confiabilidade (Completa)

#### 1. Detecção de QR Code Expirado ✅
- **Arquivo:** `src/app/(app)/settings/_components/WhatsAppQR.tsx`
- **Campo novo:** `qrCodeCreatedAt` no banco de dados
- **Funcionalidade:** 
  - Contador regressivo (120 segundos)
  - Alerta visual quando prestes a expirar
  - Refresh automático disponível

#### 2. Polling de Status de Conexão ✅
- **Arquivo:** `src/app/(app)/settings/_components/WhatsAppQR.tsx`
- **Frequência:** A cada 5 segundos
- **Comportamento:** Auto-detecta quando conectado e limpa QR code

#### 3. Função Disconnect/Logout ✅
- **Arquivo:** `src/actions/whatsapp.ts` - `disconnectWhatsApp()`
- **Função:** Desconecta da Evolution API e limpa credenciais
- **Interface:** Botão "Desconectar" no componente

#### 4. Melhor Logging ✅
- **Arquivo:** `src/app/api/webhook/evolution/route.ts`
- **Campos de log:**
  - Request ID único para rastreamento
  - Timestamp detalhado
  - Validação de assinatura
  - Deduplicação
  - Erros estruturados

### Schema do Banco Atualizado ✅

Novos campos em `WhatsAppConnection`:
```prisma
qrCodeCreatedAt DateTime?        // Track when QR was generated
lastConnectedAt DateTime?        // Last successful connection timestamp
connectionAttempts Int           // Counter for rate limiting
lastConnectionAttemptAt DateTime? // Track rate limiting
webhookSecret String?            // For HMAC verification
```

---

## 📋 O Que Fazer Agora

### 1. Variáveis de Ambiente Obrigatórias

Adicione ao seu `.env.local` ou `.env`:

```bash
# Criptografia de Tokens (OBRIGATÓRIO)
# Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=seu_key_hex_64_caracteres

# Banco de Dados
DATABASE_URL=postgresql://user:password@host:port/database

# Evolution API (já devem existir)
EVOLUTION_API_URL=https://evolution.seu-servidor.com
EVOLUTION_API_KEY=seu-api-key

# App URL (para webhooks)
NEXT_PUBLIC_APP_URL=https://seuapp.com
# Ou para dev:
# NEXT_PUBLIC_APP_URL=http://localhost:3000

# Clerk (já devem existir)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# OpenAI (já deve existir)
OPENAI_API_KEY=sk-...

# Inngest (já deve existir)
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

### 2. Executar Migração do Prisma

```bash
npx prisma migrate dev --name add_encryption_and_rate_limiting
```

Isso vai:
- Adicionar os novos campos ao banco de dados
- Criar arquivo de migração em `prisma/migrations/`

### 3. Gerar ENCRYPTION_KEY

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie a saída e adicione ao seu `.env.local`:
```
ENCRYPTION_KEY=<cole aqui>
```

### 4. Testar o QR Code

1. Vá para `/settings`
2. Seção "Conectar via QR Code"
3. Clique "Gerar QR Code"
4. Veja o contador regressivo (120 segundos)
5. Escaneie com WhatsApp no celular
6. Observe o status atualizar a cada 5 segundos

---

## 🧪 Checklist de Testes

```
[ ] ENCRYPTION_KEY configurada e válida
[ ] Database migration executada com sucesso
[ ] QR code gerado sem erros
[ ] QR code expira corretamente após 120 segundos
[ ] Contador regressivo funciona
[ ] Polling de status funciona (atualiza a cada 5s)
[ ] Webhook válida assinatura (com HMAC)
[ ] Taxa limite implementada (máx 5 tentativas/dia)
[ ] Token é descriptografado corretamente ao usar
[ ] Disconnect funciona e limpa dados
[ ] Mensagens chegam após conexão
```

---

## 🔄 Próximos Passos (Fase 3)

### Features a Implementar:
1. **UI para Seleção de Provider** (Meta vs Evolution)
2. **Gerenciamento de Múltiplas Instâncias**
3. **Dashboard de Conexões**

---

## 📚 Referência de Arquivos Modificados

| Arquivo | Mudança | Tipo |
|---------|---------|------|
| `src/lib/encryption.ts` | CRIADO | Novo módulo |
| `src/actions/whatsapp.ts` | MODIFICADO | Encryption, rate limit, disconnect |
| `src/app/api/webhook/evolution/route.ts` | MODIFICADO | Webhook signature, logging |
| `src/app/(app)/settings/_components/WhatsAppQR.tsx` | MODIFICADO | Polling, QR expiry, disconnect UI |
| `src/lib/evolution.ts` | MODIFICADO | Adicionadas funções disconnect e status |
| `prisma/schema.prisma` | MODIFICADO | Novos campos na WhatsAppConnection |

---

## 🆘 Troubleshooting

### "ENCRYPTION_KEY not set"
- Gere a chave com: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Adicione ao `.env.local`

### "Database migration failed"
- Verifique se `DATABASE_URL` está correto
- Se é PostgreSQL (necessário para este projeto)
- Tente: `npx prisma db push`

### "QR Code não expira"
- Verifique o browser console para erros
- Certifique-se de que `qrCodeCreatedAt` é salvo no DB

### "Webhook signature invalid"
- Verifique se `webhookSecret` foi gerado
- Assinatura na requisição deve ser HMAC-SHA256

---

## 💡 Notas Importantes

1. **Chave de Criptografia é Crítica**: Se perder a `ENCRYPTION_KEY`, não conseguirá descriptografar tokens armazenados!
   - Guarde em local seguro (secrets manager, vault, etc)

2. **Migrations**: Sempre execute `prisma migrate` em ambiente de produção antes de deploy

3. **Webhook Secret**: Mude para usar a Evolution API signature header se disponível

4. **Rate Limiting**: Ajuste `MAX_ATTEMPTS_PER_DAY` em `src/actions/whatsapp.ts` conforme necessário

---

**Última atualização:** 30 de Abril de 2026
