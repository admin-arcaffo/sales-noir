# ✅ CHECKLIST DE VERIFICAÇÃO - Sales Noir QR Code

## 🔍 Antes de Começar (Setup)

### Ambiente

- [ ] Node.js 24.x instalado (ou próximo)
  ```bash
  node --version  # Deve ser v24.x.x
  ```

- [ ] npm atualizado
  ```bash
  npm --version  # Deve ser 10.2.4+
  ```

- [ ] Git configurado
  ```bash
  git config --global user.name
  git config --global user.email
  ```

### Dependências

- [ ] Pacotes instalados
  ```bash
  npm list crypto-js  # Deve estar instalado
  npm list crypto     # Parte do Node (built-in)
  ```

---

## 🔐 Segurança - Verificação

### Criptografia

- [ ] Gera ENCRYPTION_KEY válida
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  # Deve gerar 64 caracteres hexadecimais
  ```

- [ ] Adiciona ENCRYPTION_KEY ao .env.local
  ```bash
  echo "ENCRYPTION_KEY=<sua_chave>" >> .env.local
  ```

- [ ] Arquivo de criptografia existe e compila
  ```bash
  ls -la src/lib/encryption.ts
  ```

- [ ] Funções exportadas corretamente
  ```bash
  grep -E "export function (encrypt|decrypt|verify|generate)" src/lib/encryption.ts
  ```

### Webhooks

- [ ] Evolution webhook suporta validação
  ```bash
  grep -n "verifyWebhookSignature" src/app/api/webhook/evolution/route.ts
  # Deve aparecer na linha ~30-40
  ```

- [ ] Meta webhook suporta validação
  ```bash
  grep -n "verifyWebhookSignature" src/app/api/webhook/whatsapp/route.ts
  # Deve aparecer
  ```

- [ ] Request ID gerado em ambos webhooks
  ```bash
  grep -c "requestId" src/app/api/webhook/*/route.ts
  # Deve retornar 2 (um para cada arquivo)
  ```

### Rate Limiting

- [ ] Rate limit implementado em whatsapp.ts
  ```bash
  grep -n "MAX_ATTEMPTS_PER_DAY" src/actions/whatsapp.ts
  # Deve existir
  ```

- [ ] Rastreamento de tentativas no DB
  ```bash
  grep -E "connectionAttempts|lastConnectionAttemptAt" prisma/schema.prisma
  # Deve aparecer ambas
  ```

---

## 🚀 Confiabilidade - Verificação

### QR Code Expiry

- [ ] Campo criado no DB
  ```bash
  grep -n "qrCodeCreatedAt" prisma/schema.prisma
  # Deve estar definido
  ```

- [ ] Componente detecta expiração
  ```bash
  grep -n "QR_EXPIRY_MS\|qrExpired" src/app/\(app\)/settings/_components/WhatsAppQR.tsx
  # Deve aparecer
  ```

- [ ] Contador regressivo implementado
  ```bash
  grep -n "QRExpiryTimer" src/app/\(app\)/settings/_components/WhatsAppQR.tsx
  # Deve existir componente
  ```

### Polling

- [ ] Polling interval definido
  ```bash
  grep -n "STATUS_POLL_INTERVAL_MS" src/app/\(app\)/settings/_components/WhatsAppQR.tsx
  # Deve ser 5000ms
  ```

- [ ] useEffect para polling existe
  ```bash
  grep -c "pollStatus" src/app/\(app\)/settings/_components/WhatsAppQR.tsx
  # Deve ser pelo menos 2 ocorrências
  ```

### Disconnect

- [ ] Função disconnect implementada
  ```bash
  grep -n "export async function disconnectWhatsApp" src/actions/whatsapp.ts
  # Deve existir
  ```

- [ ] Botão de desconectar no UI
  ```bash
  grep -n "handleDisconnect" src/app/\(app\)/settings/_components/WhatsAppQR.tsx
  # Deve existir
  ```

- [ ] Evolution API desconectar adicionado
  ```bash
  grep -n "disconnectInstance" src/lib/evolution.ts
  # Deve existir
  ```

### Logging

- [ ] IntegrationLog criado em webhooks
  ```bash
  grep -c "prisma.integrationLog.create" src/app/api/webhook/*/route.ts
  # Deve ser vários (tanto para sucesso quanto erro)
  ```

- [ ] Request IDs únicos
  ```bash
  grep -n "crypto.randomUUID\|requestId" src/app/api/webhook/evolution/route.ts
  # Deve gerar ID único
  ```

---

## 💾 Banco de Dados - Verificação

### Schema

- [ ] Schema.prisma atualizado
  ```bash
  grep -A3 "model WhatsAppConnection" prisma/schema.prisma
  # Deve ter campos novos
  ```

- [ ] Campos novos presentes:
  ```bash
  grep -E "qrCodeCreatedAt|lastConnectedAt|connectionAttempts|lastConnectionAttemptAt|webhookSecret" prisma/schema.prisma
  # Todos 5 devem aparecer
  ```

### Migrations

- [ ] Pasta de migrations existe
  ```bash
  ls -la prisma/migrations/ | head -5
  # Deve ter vários arquivos
  ```

- [ ] Pode preparar migração (sem executar em dev)
  ```bash
  npx prisma migrate status
  # Deve listar migrations
  ```

---

## 🧪 Testes de Runtime

### Build

- [ ] Build sem erros
  ```bash
  npm run build
  # Deve completar com sucesso
  ```

- [ ] Sem warnings críticos
  ```bash
  npm run build 2>&1 | grep -i error
  # Não deve retornar linhas
  ```

- [ ] Linting passa
  ```bash
  npm run lint
  # Deve passar sem erros
  ```

### Desenvolvimento

- [ ] App inicia em dev
  ```bash
  timeout 30 npm run dev
  # Deve listar logs de startup
  ```

- [ ] Nenhum erro TypeScript
  ```bash
  npx tsc --noEmit
  # Deve completar sem erros
  ```

### Imports

- [ ] Encryption module importa corretamente
  ```bash
  grep -n "import.*encryption" src/actions/whatsapp.ts src/app/api/webhook/evolution/route.ts
  # Deve ter imports
  ```

- [ ] Todas as funções são acessíveis
  ```bash
  node -e "const e = require('./src/lib/encryption.ts'); console.log(Object.keys(e))"
  # Ou verificar no código
  ```

---

## 🔄 Integração - Verificação

### Evolution API

- [ ] Funções adicionadas
  ```bash
  grep -E "disconnectInstance|getInstanceStatus" src/lib/evolution.ts
  # Ambas devem existir
  ```

- [ ] Usa token descriptografado
  ```bash
  grep -n "decryptToken" src/actions/whatsapp.ts
  # Deve aparecer
  ```

### Prisma Client

- [ ] Regenera tipo do Prisma
  ```bash
  npx prisma generate
  # Deve completar
  ```

- [ ] Tipos atualizados
  ```bash
  ls -la node_modules/.prisma/client/
  # Deve ter arquivos recentes
  ```

---

## 🐛 Debugging - Se Algo Falhar

### Erro: "ENCRYPTION_KEY not set"

```bash
# 1. Verifique se está no .env.local
cat .env.local | grep ENCRYPTION_KEY

# 2. Se não tiver, gere:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Adicione:
echo "ENCRYPTION_KEY=<resultado_acima>" >> .env.local

# 4. Reinicie o app
```

### Erro: "Database migration failed"

```bash
# 1. Verifique DATABASE_URL
echo $DATABASE_URL

# 2. Se não definido, faça:
export DATABASE_URL="postgresql://user:pass@localhost/db"

# 3. Tente novamente:
npx prisma migrate dev --name add_encryption_and_rate_limiting

# 4. Se falhar, tente push:
npx prisma db push
```

### Erro: "Module not found: encryption"

```bash
# 1. Verifique arquivo existe
ls -la src/lib/encryption.ts

# 2. Verifique permissões
chmod 644 src/lib/encryption.ts

# 3. Limpe cache do TypeScript
rm -rf .next node_modules/.cache

# 4. Instale dependências novamente
npm install
```

### Erro: "QR code não gerado"

```bash
# 1. Verifique EVOLUTION_API_URL
echo $EVOLUTION_API_URL
echo $EVOLUTION_API_KEY

# 2. Verifique console do browser (F12)
# Deve haver mensagens de erro

# 3. Verifique logs do servidor
# npm run dev deve mostrar erro

# 4. Teste endpoint manualmente:
curl -X GET "$EVOLUTION_API_URL/instance/fetch/noir-xxxxx" \
  -H "apikey: $EVOLUTION_API_KEY"
```

---

## 📋 Pré-Deployment

- [ ] ENCRYPTION_KEY seguro em secrets manager
- [ ] DATABASE_URL aponta para produção
- [ ] EVOLUTION_API_URL verificada
- [ ] WHATSAPP_APP_SECRET configurado (se usar Meta)
- [ ] Build sem erros: `npm run build`
- [ ] Prisma migrations aplicadas: `npx prisma migrate deploy`
- [ ] Ambiente validado com checklist acima
- [ ] Backup do banco feito
- [ ] Plano de rollback preparado

---

## 📞 Suporte

Se algo não funcionar:

1. Verifique este checklist acima
2. Consulte IMPLEMENTATION_GUIDE.md
3. Verifique logs com: `npm run dev` (dev mode)
4. Inspecione banco: `npx prisma studio`

---

**Última atualização:** 30 de Abril de 2026  
**Status:** ✅ Pronto para validação
