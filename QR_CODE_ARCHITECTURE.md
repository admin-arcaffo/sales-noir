# Sales Noir - WhatsApp QR Code Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE (Browser)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  /settings page                                                          │
│  ├─ WhatsAppQR Component (Client-side React)                           │
│  │  ├─ State: qrCode (base64), isLoading, status                      │
│  │  ├─ Display: QR code image or "Generate" button                     │
│  │  ├─ Actions: Generate QR, Refresh QR, Show instructions            │
│  │  └─ Listens to: Server action responses                            │
│  └─ Settings page also shows:                                          │
│     ├─ Meta API config (phone ID, WABA ID, token)                     │
│     ├─ Prompt template editor                                         │
│     └─ Integration status                                              │
│                                                                           │
└───────────────────────┬───────────────────────────────────────────────────┘
                        │
                        │ Server Action Call (RPC)
                        │
┌───────────────────────▼───────────────────────────────────────────────────┐
│                       NEXT.JS SERVER LAYER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  src/actions/whatsapp.ts:                                               │
│                                                                           │
│  createWhatsAppInstance()                                               │
│  ├─ 1. Get current organization (from Clerk)                          │
│  ├─ 2. Call evolution.createInstance(instanceName)                    │
│  │    Returns: { hash (token), base64, ... }                          │
│  ├─ 3. Store in PostgreSQL:                                           │
│  │    {                                                                │
│  │      instanceName: "noir-abc12345",                                │
│  │      instanceToken: "<hash>",                                      │
│  │      provider: "EVOLUTION",                                        │
│  │      status: "DISCONNECTED",                                       │
│  │      organizationId: "<org_id>"                                    │
│  │    }                                                                │
│  ├─ 4. Auto-configure webhook:                                        │
│  │    Call evolution.setWebhook(                                      │
│  │      instanceName,                                                 │
│  │      token,                                                        │
│  │      "https://yourdomain.com/api/webhook/evolution"               │
│  │    )                                                                │
│  └─ 5. Return { instanceName, instanceToken }                         │
│                                                                           │
│  getWhatsAppQrCode(instanceName, instanceToken)                         │
│  ├─ Call evolution.getQrCode(instanceName, instanceToken)             │
│  └─ Return { base64: "<base64_img>", code: "<qr_code_text>" }         │
│                                                                           │
└───────────────────────┬───────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼ HTTP REST    ▼ Store in DB   ▼ HTTP REST
        │              │               │
┌───────────────────┐  │    ┌──────────────────┐    │    ┌─────────────────┐
│ Evolution API    │  │    │  PostgreSQL DB   │    │    │  Webhook URL   │
│ (Third-party)    │  │    │                  │    │    │  (our app)     │
├───────────────────┤  │    ├──────────────────┤    │    ├─────────────────┤
│                   │  │    │                  │    │    │                 │
│ /instance/create  │  │    │ WhatsAppConnection   │    │ Stored for later│
│ ─────────────────►│  │    │ ────────────────►│    │    │ (after scan)    │
│                   │  │    │                  │    │    │                 │
│ Returns:         │  │    │ Columns:        │    │    │                 │
│ {                │  │    │ - id            │    │    │                 │
│   hash: "...",   │  │    │ - organizationId│    │    │                 │
│   base64: "...", │  │    │ - instanceName  │    │    │                 │
│   ...            │  │    │ - instanceToken │    │    │                 │
│ }                │  │    │ - status        │    │    │                 │
│                  │  │    │ - provider      │    │    │                 │
└──────────────────┘  │    │ - webhookSecret │    │    └─────────────────┘
                      │    │                  │    │
                      │    │ Relationships:   │    │
                      │    │ - organization   │    │
                      │    │ - integrationLogs   │
                      │    └──────────────────┘    │
                      │                           │
                      └───────────────────────────┘
```

## Message Flow After QR Code Scan

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Mobile Scanning                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ 1. User opens WhatsApp on phone                                         │
│ 2. Navigate to "Linked Devices"                                         │
│ 3. Click "Link a Device"                                                │
│ 4. Scan QR code from browser screen                                     │
│ 5. Mobile WhatsApp connects to Evolution API with instanceName + token  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Message Received on Mobile → Evolution API                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ 1. User receives WhatsApp message on linked phone                       │
│ 2. Message details:                                                      │
│    {                                                                     │
│      instanceName: "noir-abc12345",                                     │
│      event: "messages.upsert",                                          │
│      data: {                                                            │
│        key: {                                                           │
│          fromMe: false,                                                 │
│          id: "wamessageid_xyz",                                         │
│          remoteJid: "5511999999999@s.whatsapp.net"                      │
│        },                                                               │
│        message: {                                                       │
│          conversation: "Olá! Tudo bem?",                               │
│          // OR for audio:                                             │
│          audioMessage: {                                               │
│            url: "https://...",                                         │
│            mediaKey: "...",                                            │
│            mimeType: "audio/ogg"                                       │
│          }                                                              │
│        },                                                               │
│        pushName: "João Silva",                                          │
│        timestamp: 1698765432                                           │
│      }                                                                  │
│    }                                                                     │
│ 3. Evolution API queues webhook delivery                               │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Evolution Webhook → Our App                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ HTTP POST /api/webhook/evolution                                        │
│                                                                           │
│ Request Body:                                                           │
│ {                                                                        │
│   event: "messages.upsert",                                             │
│   instance: "noir-abc12345",                                            │
│   data: { ... }                                                         │
│ }                                                                        │
│                                                                           │
│ Handler: src/app/api/webhook/evolution/route.ts                        │
│                                                                           │
│ Processing:                                                             │
│ 1. Parse event type (messages.upsert)                                  │
│ 2. Extract: phone, message content, sender name                        │
│ 3. Look up WhatsAppConnection by instanceName                          │
│ 4. Get organizationId from connection                                   │
│ 5. Deduplication: Check if waMessageId already exists                  │
│ 6. Upsert Contact:                                                      │
│    {                                                                     │
│      phone: "5511999999999",                                            │
│      name: "João Silva",                                               │
│      organizationId: "<org_id>",                                        │
│      origin: null (will be set later)                                  │
│    }                                                                     │
│ 7. Ensure OPEN conversation exists:                                    │
│    {                                                                     │
│      contactId: "<contact_id>",                                         │
│      status: "OPEN",                                                    │
│      stage: "PRIMEIRO_CONTATO",                                        │
│      temperature: "COLD",                                               │
│      lastMessageAt: <timestamp>                                        │
│    }                                                                     │
│ 8. Create Message record:                                               │
│    {                                                                     │
│      conversationId: "<conv_id>",                                       │
│      direction: "INBOUND",                                              │
│      type: "TEXT" OR "AUDIO",                                          │
│      content: "Olá! Tudo bem?",                                         │
│      waMessageId: "wamessageid_xyz",                                    │
│      timestamp: <timestamp>                                             │
│    }                                                                     │
│ 9. Trigger async job (Inngest):                                         │
│    - If TEXT: Send "conversation/analyze-requested" event              │
│    - If AUDIO: Send "whatsapp/audio.received" event                   │
│                                                                           │
│ Response: { success: true }                                             │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: Async Processing (Inngest)                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ If TEXT message:                                                         │
│ ─────────────────                                                        │
│ Event: "conversation/analyze-requested"                                 │
│ Data: { conversationId, organizationId }                               │
│                                                                           │
│ Handler: src/inngest/functions.ts                                      │
│ 1. Fetch all messages in conversation                                   │
│ 2. Call OpenAI GPT-4 with SYSTEM_PROMPT_SALES_COPILOT                 │
│ 3. Parse JSON response with analysis:                                  │
│    {                                                                     │
│      summary: "Lead demonstra interesse inicial...",                    │
│      stage: "PRIMEIRO_CONTATO",                                        │
│      leadClassification: "LEAD_FRIO",                                  │
│      urgency: "BAIXA",                                                 │
│      painPoints: [...],                                                │
│      explicitObjections: [...],                                        │
│      implicitObjections: [...],                                        │
│      buyingSignals: [...],                                             │
│      riskLevel: "BAIXO",                                               │
│      recommendedPosture: "Seja consultivo e descoberto...",            │
│      whatToAvoid: "Pressão de vendas óbvia",                          │
│      nextConcreteStep: "Agende uma call para ...",                     │
│      suggestedReplies: {                                               │
│        direct: "...",                                                  │
│        consultative: "...",                                             │
│        whatsappShort: "..."                                            │
│      }                                                                   │
│    }                                                                     │
│ 4. Store AIAnalysis record in database                                 │
│ 5. Store 3 SuggestedReply records                                      │
│                                                                           │
│ If AUDIO message:                                                        │
│ ─────────────────                                                        │
│ Event: "whatsapp/audio.received"                                       │
│ Data: { messageId, mediaId, organizationId }                           │
│                                                                           │
│ Handler: src/inngest/functions.ts                                      │
│ 1. Download audio from Evolution API                                    │
│ 2. Send to OpenAI Whisper API for transcription                        │
│ 3. Store AudioTranscript record:                                       │
│    {                                                                     │
│      messageId: "<msg_id>",                                             │
│      text: "Transcrição em português...",                              │
│      status: "COMPLETED",                                               │
│      language: "pt-BR"                                                 │
│    }                                                                     │
│ 4. Trigger conversation analysis with transcribed text                 │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: UI Updates (Real-time)                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ 1. /conversations page refreshes (polling or revalidatePath)           │
│ 2. Shows new message from contact                                       │
│ 3. Shows AI analysis in sidebar:                                       │
│    - Lead classification badge                                         │
│    - Suggested replies (user can pick one to send)                     │
│ 4. /dashboard updates KPIs in real-time                                │
│ 5. Contact appears in /leads list                                      │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Database Schema - WhatsAppConnection Table

```sql
CREATE TABLE "WhatsAppConnection" (
  id              TEXT PRIMARY KEY,
  organizationId  TEXT NOT NULL,
  
  -- Meta API fields (optional, for manual setup)
  phoneNumberId   TEXT,
  wabaId          TEXT,
  accessToken     TEXT,
  
  -- Evolution API fields (for QR code setup)
  provider        TEXT DEFAULT 'META',
  instanceName    TEXT UNIQUE,
  instanceToken   TEXT,
  webhookSecret   TEXT,
  
  -- Status tracking
  status          TEXT DEFAULT 'DISCONNECTED',
  lastSyncAt      TIMESTAMP,
  
  -- Metadata
  createdAt       TIMESTAMP DEFAULT now(),
  updatedAt       TIMESTAMP DEFAULT now(),
  
  -- Foreign key
  organizationId  TEXT NOT NULL REFERENCES "Organization"(id),
  
  INDEX idx_org_id (organizationId),
  INDEX idx_phone_number_id (phoneNumberId),
  UNIQUE (instanceName)
);
```

## Environment Variables

```bash
# Evolution API (QR Code Provider)
EVOLUTION_API_URL=https://evolution-api.your-domain.com
EVOLUTION_API_KEY=your-api-key-here

# Webhook Callbacks
NEXT_PUBLIC_APP_URL=https://yourdomain.com
# OR
VERCEL_URL=yourdomain.vercel.app

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Meta WhatsApp API (Optional, for manual setup)
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_ACCESS_TOKEN=your-access-token

# Database
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true

# OpenAI (for conversation analysis)
OPENAI_API_KEY=sk-...

# Inngest (async jobs)
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

## Error Handling & Retry Logic

### Current Issues (Needs Fixing)
1. No automatic retry if Evolution API fails
2. No connection status polling
3. QR code expiry not detected
4. Webhook configuration failure doesn't rollback instance creation

### Recommended Solutions
1. Add exponential backoff retry in client component
2. Add background job to poll instance status every 5 minutes
3. Track QR code generation timestamp, auto-refresh if > 120 seconds
4. Validate webhook before marking instance CONNECTED

## Security Considerations

### Current Weaknesses
1. Instance tokens stored in plaintext
2. No webhook signature verification
3. No rate limiting on instance creation
4. No audit trail for connection changes

### Recommended Mitigations
1. Encrypt tokens at rest (field-level encryption in Prisma)
2. Implement webhook HMAC signature verification
3. Add rate limiting (max 1 instance per org per day)
4. Log all connection changes to AuditLog table

## Testing Checklist

```
QR Code Flow:
- [ ] Generate QR code via UI
- [ ] Verify base64 image displays correctly
- [ ] Verify instance saved in database
- [ ] Verify webhook auto-configured
- [ ] Scan QR code on mobile
- [ ] Verify connection status changes to CONNECTED within 5 seconds
- [ ] Send message from mobile
- [ ] Verify message appears in conversations list
- [ ] Verify AI analysis appears within 30 seconds

Message Flow:
- [ ] Text message → database → UI
- [ ] Audio message → transcription → AI analysis
- [ ] Suggested replies display correctly
- [ ] User can send reply back to contact

Provider Switching:
- [ ] Can configure Meta API
- [ ] Can configure Evolution QR Code
- [ ] Can switch between providers
- [ ] Webhook routing works correctly

Error Cases:
- [ ] Evolution API unreachable → graceful error message
- [ ] Invalid token → clear error to user
- [ ] Webhook delivery fails → logged in database
- [ ] Message deduplication works (no duplicates)
```

## Performance Considerations

- QR code generation: < 2 seconds (depends on Evolution API)
- Message webhook delivery: < 1 second (queue processing)
- AI analysis: 5-30 seconds (depends on OpenAI response time)
- Audio transcription: 10-60 seconds (depends on Whisper queue)
- UI refresh: Real-time with revalidatePath or polling

## Deployment Steps

1. **Environment Setup**
   ```bash
   # Set all required env vars in Vercel dashboard
   # Ensure Evolution API is accessible from Vercel
   # Ensure database is accessible with pgbouncer pooling
   ```

2. **Database Migrations**
   ```bash
   npm run db:migrate:deploy
   ```

3. **Deploy to Vercel**
   ```bash
   # Automatic via git push or manual deploy
   ```

4. **Configure Webhooks**
   - Evolution API: Auto-configured by app
   - Clerk: Add domain to Clerk dashboard
   - Inngest: Already configured in code

5. **Test QR Code Flow**
   - Create test organization
   - Generate QR code
   - Scan with test phone
   - Send test message
   - Verify flow end-to-end
