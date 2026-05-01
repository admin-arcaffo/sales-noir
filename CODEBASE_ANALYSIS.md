# Sales Noir - Codebase Analysis Report

## 1. PROJECT OVERVIEW

**Project Name:** Sales Noir  
**Type:** AI-powered Commercial CRM with WhatsApp Integration  
**Framework:** Next.js 16 (React 19)  
**Status:** Development  
**Version:** 0.1.0 (Private)

### Primary Stack
- **Frontend:** React 19, Next.js 16 (App Router), Tailwind CSS 4
- **Backend:** Next.js API Routes, Server Actions
- **Database:** PostgreSQL via Prisma ORM
- **Authentication:** Clerk (SaaS)
- **AI/ML:** OpenAI (GPT-4 for conversation analysis, Whisper for audio transcription)
- **Async Jobs:** Inngest (event-driven task queue)
- **WhatsApp Integration:** Two providers supported:
  - Meta (Facebook) WhatsApp Business Cloud API
  - Evolution API (QR code based connection)

---

## 2. PROJECT STRUCTURE

```
Sales Noir/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (app)/                    # Protected routes (authenticated)
│   │   │   ├── dashboard/
│   │   │   ├── conversations/        # Chat/message inbox
│   │   │   ├── leads/                # Lead management
│   │   │   ├── tasks/                # Task/follow-up management
│   │   │   ├── settings/             # Configuration & integrations
│   │   │   │   └── _components/
│   │   │   │       └── WhatsAppQR.tsx # QR Code connection component
│   │   │   └── layout.tsx            # Shared sidebar layout
│   │   ├── api/
│   │   │   ├── webhook/
│   │   │   │   ├── whatsapp/route.ts # Meta API webhook handler
│   │   │   │   └── evolution/route.ts # Evolution API webhook handler
│   │   │   ├── inngest/route.ts      # Async job management
│   │   │   └── analyze/route.ts      # AI analysis endpoint
│   │   ├── sign-in/                  # Clerk auth
│   │   ├── sign-up/                  # Clerk auth
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Home page
│   ├── actions/                      # Server Actions (RPC)
│   │   ├── crm.ts                    # CRM operations (dashboard, leads, tasks, analysis)
│   │   └── whatsapp.ts               # WhatsApp instance management
│   ├── lib/
│   │   ├── prisma.ts                 # Prisma client singleton
│   │   ├── workspace.ts              # Multi-org workspace utilities
│   │   ├── whatsapp.ts               # Meta API client functions
│   │   ├── evolution.ts              # Evolution API client
│   │   └── ai/
│   │       └── prompts.ts            # OpenAI system prompts & response schema
│   ├── inngest/
│   │   ├── client.ts                 # Inngest client init
│   │   └── functions.ts              # Async job definitions (audio transcription, analysis)
│   └── proxy.ts                      # Utility file (unclear purpose)
├── prisma/
│   ├── schema.prisma                 # Database schema
│   ├── migrations/                   # Database migration history
│   └── seed.mjs                      # Database seeding script
├── public/                           # Static assets
├── .next/                            # Build output (ignored in git)
├── node_modules/                     # Dependencies
├── package.json                      # Dependencies & scripts
├── next.config.ts                    # Next.js configuration
├── tsconfig.json                     # TypeScript configuration
├── eslint.config.mjs                 # ESLint rules
├── postcss.config.mjs                # PostCSS/Tailwind config
├── .env.example                      # Environment template
├── .vercelignore                     # Vercel deployment ignore list
├── vercel.json                       # Vercel deployment config (if present)
├── README.md                         # Project documentation
└── AGENTS.md                         # Agent development rules
```

---

## 3. MAIN FEATURES & FUNCTIONALITY

### 3.1 Dashboard
- **File:** `src/app/(app)/dashboard/page.tsx`
- **KPIs Displayed:**
  - Active conversations count
  - Hot leads count
  - Pending tasks
  - Proposals in progress
- **Data:** Recent AI analyses, urgent conversations (HOT temperature, no response > 24h)

### 3.2 Conversations (WhatsApp Inbox)
- **File:** `src/app/(app)/conversations/page.tsx`
- **Features:**
  - List all conversations with contacts
  - Show message thread for selected conversation
  - Display latest AI analysis with suggested replies (3 variants)
  - Send outbound WhatsApp messages
  - View message timestamps, types (TEXT, AUDIO, IMAGE, DOCUMENT)
  - Stage tracking (PRIMEIRO_CONTATO → FECHAMENTO)
  - Temperature classification (COLD, WARM, HOT)

### 3.3 Leads Management
- **File:** `src/app/(app)/leads/page.tsx`
- **Data Tracked:**
  - Contact info (phone, name, company, email)
  - Lead stage in pipeline
  - Temperature (sales maturity)
  - Potential value (BRL currency)
  - Last contact time
  - Origin (website, referral, ads, organic)
  - Associated conversations & tasks
  - Notes on lead

### 3.4 Tasks & Follow-ups
- **File:** `src/app/(app)/tasks/page.tsx`
- **Features:**
  - Create tasks (FOLLOW_UP, CALL, MEETING, PROPOSAL, OTHER)
  - Priority levels (LOW, MEDIUM, HIGH, URGENT)
  - Status tracking (PENDING, IN_PROGRESS, DONE, CANCELLED)
  - Due date management
  - Link tasks to contacts
  - Mark complete with timestamp

### 3.5 Settings & Configuration
- **File:** `src/app/(app)/settings/page.tsx`
- **Sections:**
  - **WhatsApp Official (Meta):** Configure phone number ID, WABA ID, access token
  - **WhatsApp QR Code (Evolution):** Generate instance, get QR code for mobile connection
  - **Prompt Templates:** Create/edit system prompts for AI analysis (Orchestrator + Auxiliary contexts)
  - **Integration Status:** Show OpenAI, Inngest, WhatsApp connection health
  - **API Configuration:** Manage external service credentials

### 3.6 AI-Powered Analysis
- **Location:** `src/lib/ai/prompts.ts` + async jobs in `src/inngest/functions.ts`
- **Trigger:** After each inbound message
- **Analysis Outputs:**
  - Summary of conversation state
  - Sales stage detection
  - Lead temperature classification
  - Urgency level
  - Pain points identified
  - Explicit & implicit objections
  - Buying signals
  - Risk level assessment
  - Recommended sales posture
  - Pitfalls to avoid
  - Next concrete action
  - 3 suggested reply templates:
    - Direct (action-oriented)
    - Consultative (value-driven)
    - WhatsApp Short (brief & informal)

---

## 4. WHATSAPP QR CODE FUNCTIONALITY (CURRENT STATE)

### 4.1 Current Implementation

#### **WhatsAppQR Component** (`src/app/(app)/settings/_components/WhatsAppQR.tsx`)
- **Type:** Client-side React component
- **State Management:** Local React state (qrCode, isLoading, status)
- **Functionality:**
  1. **Generate Instance Button:** Calls `createWhatsAppInstance()` server action
  2. **Display QR Code:** Shows base64-encoded image after generation
  3. **Refresh Button:** Allows re-fetching latest QR code
  4. **Status Display:**
     - `CONNECTED`: Shows success message with checkmark
     - `DISCONNECTED`: Shows "Generate QR Code" button
     - `QRCODE`: Shows actual QR code image
  5. **Instructions Panel:** Step-by-step guide for scanning on mobile

#### **WhatsApp Instance Creation** (`src/actions/whatsapp.ts`)
```typescript
export async function createWhatsAppInstance() {
  // 1. Get current organization
  // 2. Create instance on Evolution API
  // 3. Store instance name & token in DB (WhatsAppConnection)
  // 4. Auto-configure webhook URL
  // 5. Return instance credentials
}
```

**Key Actions:**
- `createWhatsAppInstance()` - Creates new Evolution API instance
- `getWhatsAppQrCode(instanceName, instanceToken)` - Fetches QR code for instance
- `getWhatsAppStatus()` - Checks connection status

#### **Evolution API Client** (`src/lib/evolution.ts`)
```typescript
export const evolution = {
  createInstance: async (instanceName) => {...},      // POST /instance/create
  getQrCode: async (instanceName, token) => {...},    // GET /instance/connect/{name}
  setWebhook: async (instanceName, token, url) => {...}, // POST /webhook/set/{name}
  sendText: async (instanceName, token, to, text) => {...} // POST /message/sendText/{name}
}
```

#### **Database Schema** (`prisma/schema.prisma`)
```prisma
model WhatsAppConnection {
  id             String   @id @default(cuid())
  organizationId String
  
  // Meta API fields
  phoneNumberId  String?
  wabaId         String?
  accessToken    String?  @db.Text
  
  // Evolution API fields (QR code)
  provider       String   @default("META")      // META or EVOLUTION
  instanceName   String?  @unique
  instanceToken  String?  @db.Text
  webhookSecret  String?
  
  status         String   @default("DISCONNECTED") // CONNECTED, DISCONNECTED, ERROR, PAUSED
  lastSyncAt     DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  organization    Organization     @relation(...)
  integrationLogs IntegrationLog[]
}
```

### 4.2 Webhook Handlers

#### **Evolution Webhook** (`src/app/api/webhook/evolution/route.ts`)
- **Endpoint:** `POST /api/webhook/evolution`
- **Events Handled:**
  - `messages.upsert` - New inbound message
  - Auto-creates/updates Contact
  - Auto-creates/updates Conversation
  - Stores message in DB
  - Triggers Inngest `conversation/analyze-requested` for text messages
  - Triggers Inngest `whatsapp/audio.received` for audio messages

#### **Meta WhatsApp Webhook** (`src/app/api/webhook/whatsapp/route.ts`)
- **Endpoint:** `POST /api/webhook/whatsapp`
- **Verification:** GET with `hub.verify_token`
- **Events Handled:** Similar to Evolution but uses Meta's message structure
- **Key Difference:** Expects `message.from`, `message.type`, `message.text.body`

### 4.3 Supported Provider Models

| Feature | Meta API | Evolution QR |
|---------|----------|-------------|
| Setup | Manual (phone ID, token) | Auto-generated via QR |
| Authentication | Access Token | Instance Token (hash) |
| Webhook Config | Manual setup in Meta dashboard | Auto-configured |
| Message Types | TEXT, AUDIO, IMAGE, DOCUMENT | TEXT, AUDIO, IMAGE, DOCUMENT |
| Connection Status | CONNECTED (if credentials provided) | CONNECTED (after QR scan) |
| Database Fields | `phoneNumberId`, `wabaId`, `accessToken` | `instanceName`, `instanceToken` |

---

## 5. KEY PAGES, COMPONENTS & API ROUTES

### 5.1 Pages (Next.js App Router)

| Path | File | Purpose |
|------|------|---------|
| `/` | `src/app/page.tsx` | Landing/home page |
| `/sign-in` | `src/app/sign-in/[[...sign-in]]/page.tsx` | Clerk sign-in |
| `/sign-up` | `src/app/sign-up/[[...sign-up]]/page.tsx` | Clerk sign-up |
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | KPIs & recent activity |
| `/conversations` | `src/app/(app)/conversations/page.tsx` | WhatsApp inbox |
| `/leads` | `src/app/(app)/leads/page.tsx` | Lead pipeline |
| `/tasks` | `src/app/(app)/tasks/page.tsx` | Task management |
| `/settings` | `src/app/(app)/settings/page.tsx` | Config & integrations |

### 5.2 Components

| Component | File | Purpose |
|-----------|------|---------|
| `WhatsAppQR` | `src/app/(app)/settings/_components/WhatsAppQR.tsx` | QR code display & generation UI |
| `AppLayout` | `src/app/(app)/layout.tsx` | Sidebar nav + auth wrapper |

### 5.3 API Routes

| Route | Method | File | Purpose |
|-------|--------|------|---------|
| `/api/webhook/whatsapp` | POST, GET | `src/app/api/webhook/whatsapp/route.ts` | Meta WhatsApp webhook |
| `/api/webhook/evolution` | POST | `src/app/api/webhook/evolution/route.ts` | Evolution API webhook |
| `/api/inngest` | POST | `src/app/api/inngest/route.ts` | Inngest job handler |
| `/api/analyze` | POST | `src/app/api/analyze/route.ts` | Manual analysis trigger (if exists) |

### 5.4 Server Actions

| Function | File | Purpose |
|----------|------|---------|
| `createWhatsAppInstance()` | `src/actions/whatsapp.ts` | Create Evolution instance |
| `getWhatsAppQrCode()` | `src/actions/whatsapp.ts` | Fetch QR code image |
| `getWhatsAppStatus()` | `src/actions/whatsapp.ts` | Get connection status |
| `getDashboardData()` | `src/actions/crm.ts` | Load dashboard KPIs |
| `getConversations()` | `src/actions/crm.ts` | Load inbox messages |
| `getLeads()` | `src/actions/crm.ts` | Load lead list |
| `getTasks()` | `src/actions/crm.ts` | Load task list |
| `sendConversationMessage()` | `src/actions/crm.ts` | Send WhatsApp message |
| `saveWhatsAppConnectionSettings()` | `src/actions/crm.ts` | Store Meta credentials |
| `savePromptTemplateVersion()` | `src/actions/crm.ts` | Save AI prompt version |

### 5.5 Async Job Functions (Inngest)

| Function | File | Trigger | Purpose |
|----------|------|---------|---------|
| `processAudioTranscript` | `src/inngest/functions.ts` | `whatsapp/audio.received` | Transcribe audio with Whisper API |
| (Analysis function) | `src/inngest/functions.ts` | `conversation/analyze-requested` | Call OpenAI for commercial analysis |

---

## 6. DATABASE SCHEMA SUMMARY

### Core Entities

**Organization** - Workspace owner
- `id`, `name`, `slug`, `plan`, `createdAt`, `updatedAt`
- Relations: `users`, `contacts`, `prompts`, `whatsappConnections`, `auditLogs`

**User** - Team member
- `id`, `clerkId`, `email`, `name`, `role`, `organizationId`, `createdAt`, `updatedAt`
- Relations: `organization`, `analyses`, `tasks`, `auditLogs`

**Contact** - Lead/customer
- `id`, `phone`, `name`, `company`, `email`, `avatarUrl`, `origin`, `interestArea`, `potentialValue`, `notes`, `organizationId`, `createdAt`, `updatedAt`
- Relations: `organization`, `conversations`, `leadHistory`, `tasks`

**Conversation** - Chat thread
- `id`, `contactId`, `status` (OPEN/CLOSED/SNOOZED), `stage` (8 stages), `temperature` (COLD/WARM/HOT), `outcome`, `lastMessageAt`, `createdAt`, `updatedAt`
- Relations: `contact`, `messages`, `analyses`

**Message** - Individual message
- `id`, `conversationId`, `direction` (INBOUND/OUTBOUND), `type` (TEXT/AUDIO/IMAGE/DOCUMENT/VIDEO/STICKER), `content`, `mediaUrl`, `waMessageId`, `timestamp`
- Relations: `conversation`, `transcript`, `media`

**AudioTranscript** - Whisper transcription result
- `id`, `messageId`, `text`, `confidence`, `duration`, `language`, `provider`, `status` (PENDING/PROCESSING/COMPLETED/FAILED), `errorMsg`, `retries`, `createdAt`, `updatedAt`

**AIAnalysis** - Commercial analysis snapshot
- `id`, `conversationId`, `userId`, `summary`, `stage`, `leadClassification`, `urgency`, `riskLevel`, `painPoints` (JSON), `explicitObjections` (JSON), `implicitObjections` (JSON), `buyingSignals` (JSON), `recommendedPosture`, `whatToAvoid`, `nextConcreteStep`, `timeWindow`, `messageCount`, `processingTimeMs`, `createdAt`
- Relations: `conversation`, `user`, `suggestedReplies`

**SuggestedReply** - AI-generated reply variants
- `id`, `analysisId`, `type` (DIRECT/CONSULTATIVE/WHATSAPP_SHORT), `content`, `wasUsed`, `wasEdited`, `editedContent`, `createdAt`

**Task** - Follow-up task
- `id`, `contactId`, `userId`, `title`, `description`, `type` (FOLLOW_UP/CALL/MEETING/PROPOSAL/OTHER), `priority` (LOW/MEDIUM/HIGH/URGENT), `status` (PENDING/IN_PROGRESS/DONE/CANCELLED), `dueAt`, `completedAt`, `createdAt`, `updatedAt`

**WhatsAppConnection** - Integration credentials
- See section 4.3 above

**PromptTemplate** - AI system prompts
- `id`, `organizationId`, `name`, `slug`, `content`, `category` (analysis/reply/follow_up/qualification), `version`, `isActive`, `metadata` (JSON), `createdAt`, `updatedAt`

---

## 7. CONFIGURATION FILES

### 7.1 Environment Variables Required

```
# Clerk (Authentication)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_DOMAIN=sales.arcaffo.com

# Database
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true

# WhatsApp (Meta API)
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_ACCESS_TOKEN=...

# OpenAI
OPENAI_API_KEY=sk-...

# Inngest (Async jobs)
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# Evolution API (QR code provider)
EVOLUTION_API_URL=https://evolution-api.your-domain.com
EVOLUTION_API_KEY=your-api-key

# App URL (for webhook callbacks)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
VERCEL_URL=yourdomain.vercel.app (auto-set by Vercel)
```

### 7.2 Key Configuration Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js build & runtime settings |
| `tsconfig.json` | TypeScript compiler options |
| `tailwind.config.mjs` | Tailwind CSS styling |
| `postcss.config.mjs` | PostCSS processing |
| `eslint.config.mjs` | Code linting rules |
| `prisma/schema.prisma` | Database schema definition |

### 7.3 Deployment Files

| File | Purpose |
|------|---------|
| `vercel.json` | Vercel deployment config |
| `.vercelignore` | Files to exclude from Vercel build |
| `.gitignore` | Files to exclude from git |
| `.env.example` | Template for local .env file |

---

## 8. AREAS NEEDING ATTENTION FOR QR CODE WHATSAPP FUNCTIONALITY

### 8.1 Critical Issues

1. **Evolution API Dependency Not in package.json**
   - Currently using custom client wrapper (`src/lib/evolution.ts`)
   - No npm package dependency for Evolution API
   - Recommendation: Either add official SDK or ensure API URL/Key are always configured

2. **QR Code Base64 Format**
   - Assumes Evolution API returns `base64` field directly
   - Fallback logic: `data.base64 || data.code?.base64`
   - **Risk:** Format mismatch if API changes response structure
   - Action: Add validation & error handling

3. **Instance Token Security**
   - Instance tokens stored in plaintext in database (`WhatsAppConnection.instanceToken`)
   - Should be encrypted at rest
   - Recommendation: Use database field-level encryption or external vault

4. **No Token Rotation/Expiry Logic**
   - If Evolution API tokens expire, no automatic refresh implemented
   - Action: Add token refresh mechanism + expiry timestamps

5. **Webhook Auto-Configuration**
   - Currently calls `evolution.setWebhook()` during instance creation
   - If webhook setup fails, instance is still created (orphaned)
   - Action: Make webhook setup prerequisite before marking instance CONNECTED

### 8.2 Missing Features

1. **No Instance Connection Status Polling**
   - `status` field is set to 'CONNECTED' but never updated based on actual WhatsApp connection state
   - Should periodically check if WhatsApp is still authenticated
   - Action: Add background job to verify connection health

2. **No Disconnect/Logout Feature**
   - Users can create instance but cannot disconnect/revoke access
   - Action: Implement instance deletion/disconnect endpoint

3. **No QR Code Expiry Management**
   - QR codes typically expire after 60-120 seconds
   - Current UI doesn't show expiry time or auto-refresh
   - Action: Track QR code generation timestamp + auto-refresh if expired

4. **No Provider Switching**
   - Users can configure both Meta AND Evolution providers
   - No logic to prevent conflicts or choose default provider
   - Action: Implement provider selection UI + conflict resolution

5. **No Instance Rate Limiting**
   - Users can call `createWhatsAppInstance()` unlimited times
   - Creates orphaned instances in Evolution API
   - Action: Add rate limiting + validation (max 1 active instance per org)

6. **Insufficient Error Messages**
   - Generic "Configuração da API de WhatsApp pendente" doesn't help debugging
   - Action: Log detailed Evolution API errors to database (IntegrationLog)

### 8.3 Performance/Reliability Issues

1. **QR Code Fetching Delays**
   - Client-side component waits for server action synchronously
   - No progress indication during network delay
   - Action: Show skeleton loader, add timeout handling

2. **No Retry Logic**
   - If Evolution API call fails, no automatic retry
   - Action: Add exponential backoff retry in client component

3. **Webhook URL Validation**
   - Webhook auto-configuration uses `process.env.NEXT_PUBLIC_APP_URL` or `VERCEL_URL`
   - If both are missing, webhook won't be configured
   - Action: Validate webhook URL in form before saving instance

4. **No Instance List/Management UI**
   - Users can only see current instance in settings
   - If multiple instances are created, no way to switch between them
   - Action: Add instance selector dropdown

### 8.4 Integration Points Requiring Testing

1. **Evolution → Prisma Sync**
   - After QR code scan on mobile, Evolution API should trigger webhook
   - Webhook must update `WhatsAppConnection.status` to 'CONNECTED'
   - **Test:** Scan QR code, verify status changes in UI in <5 seconds

2. **Message Flow**
   - Test full loop: Mobile WhatsApp → Evolution API → Webhook → Prisma → UI
   - Verify deduplication works (`waMessageId` unique constraint)

3. **Audio Transcription**
   - Audio messages should trigger Inngest job
   - Whisper transcription should complete & store in `AudioTranscript`
   - **Test:** Send audio message, verify transcript appears in 30-60 seconds

4. **Webhook Secret Validation**
   - Evolution webhook should include signature/authentication
   - Currently no validation in webhook handler
   - Action: Implement webhook signature verification

### 8.5 Code Quality Issues

1. **Type Safety**
   - `WhatsAppQR.tsx` receives `instanceToken?: string | null` but doesn't validate
   - `evolution.getQrCode()` response parsing is fragile

2. **Error Boundaries**
   - No error boundary component for settings page
   - Fatal errors could crash entire page

3. **Accessibility**
   - QR code image has `alt="WhatsApp QR Code"` but no loading state indication
   - Refresh button has no visual feedback during loading

---

## 9. RECOMMENDED IMPLEMENTATION ROADMAP

### Phase 1: Stabilize Current QR Code Implementation
- [ ] Add validation for Evolution API response structure
- [ ] Encrypt instance tokens in database
- [ ] Add comprehensive error logging to IntegrationLog
- [ ] Implement QR code expiry detection & auto-refresh
- [ ] Add client-side retry logic with exponential backoff

### Phase 2: Add Provider Management
- [ ] Create provider selection UI (Meta vs Evolution)
- [ ] Implement provider-specific field validation
- [ ] Add conflict prevention (ensure only 1 active provider per org)
- [ ] Create instance list/management interface

### Phase 3: Enhance Connection Health
- [ ] Add background job to periodically verify Evolution connection status
- [ ] Implement connection status polling in UI (WebSocket or polling)
- [ ] Add disconnect/logout feature with clean database cleanup
- [ ] Show real-time connection status badge in UI

### Phase 4: Security & Compliance
- [ ] Implement webhook signature verification
- [ ] Add field-level encryption for tokens
- [ ] Add audit logging for connection changes
- [ ] Implement token rotation mechanism

### Phase 5: Production Readiness
- [ ] Load testing for webhook handler (high message volume)
- [ ] E2E testing for QR code flow
- [ ] Integration testing for both Meta & Evolution providers
- [ ] Documentation for setup & troubleshooting

---

## 10. FILE MANIFEST

### All TypeScript/TSX Files (25 total)

```
Pages (6):
- src/app/page.tsx
- src/app/sign-in/[[...sign-in]]/page.tsx
- src/app/sign-up/[[...sign-up]]/page.tsx
- src/app/(app)/dashboard/page.tsx
- src/app/(app)/conversations/page.tsx
- src/app/(app)/leads/page.tsx
- src/app/(app)/tasks/page.tsx
- src/app/(app)/settings/page.tsx

API Routes (4):
- src/app/api/webhook/whatsapp/route.ts
- src/app/api/webhook/evolution/route.ts
- src/app/api/inngest/route.ts
- src/app/api/analyze/route.ts

Components (2):
- src/app/(app)/settings/_components/WhatsAppQR.tsx
- src/app/(app)/layout.tsx

Layouts (1):
- src/app/layout.tsx

Server Actions (2):
- src/actions/crm.ts (~700 lines)
- src/actions/whatsapp.ts (88 lines)

Library/Utilities (5):
- src/lib/prisma.ts
- src/lib/workspace.ts
- src/lib/whatsapp.ts
- src/lib/evolution.ts
- src/lib/ai/prompts.ts

Async Jobs (2):
- src/inngest/client.ts
- src/inngest/functions.ts

Root (1):
- src/proxy.ts (unclear purpose)
```

---

## 11. SUMMARY OF QR CODE WHATSAPP ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BROWSER                              │
├─────────────────────────────────────────────────────────────┤
│ WhatsAppQR.tsx                                               │
│  - Show QR code image                                        │
│  - Refresh button                                            │
│  - Generate button                                           │
└────────┬─────────────────────────────────────────────────────┘
         │ Server Action
         ▼
┌─────────────────────────────────────────────────────────────┐
│               NEXT.JS SERVER (src/actions)                   │
├─────────────────────────────────────────────────────────────┤
│ createWhatsAppInstance()                                     │
│ getWhatsAppQrCode()                                          │
│ getWhatsAppStatus()                                          │
└────────┬─────────────────────────────────────────────────────┘
         │
         ├────────────────────────────┬──────────────────────────┐
         │ HTTP REST                  │ HTTP REST               │
         ▼                            ▼                          ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Evolution API   │      │  PostgreSQL DB   │      │  WhatsApp Mobile │
│  /instance/create│      │                  │      │  (QR Scan)       │
│  /instance/connect│     │  WhatsAppConnection│    └──────────────────┘
│                  │      │  - instanceName  │
│  Returns:        │      │  - instanceToken │
│  - base64 QR img │      │  - status        │
│  - hash token    │      │  - provider      │
└──────────────────┘      └──────────────────┘

Once Connected:
┌────────────────────────────────────────────────────────────┐
│             WhatsApp Message (Mobile → Evolution)           │
└────────┬─────────────────────────────────────────────────────┘
         │ Webhook HTTP POST
         ▼
┌──────────────────────────────────────────────────────────────┐
│  POST /api/webhook/evolution                                 │
│  - Receives: messages.upsert event                           │
│  - Extract: phone, message text, media                       │
│  - Upsert: Contact in DB                                     │
│  - Create: Conversation + Message records                    │
│  - Trigger: Inngest audio.received (if audio)                │
│            Inngest conversation/analyze (if text)            │
└──────────────────────────────────────────────────────────────┘
         │
         ├──────────────┬─────────────────────┐
         ▼              ▼                      ▼
    ┌─────────┐  ┌────────────┐         ┌──────────┐
    │ Inngest │  │ PostgreSQL │         │ OpenAI  │
    │ Queue   │  │   Store    │         │ Whisper │
    │ (Async) │  │ Message    │         │ (Audio) │
    └─────────┘  └────────────┘         └──────────┘
```

---

## CONCLUSION

Sales Noir is a sophisticated, multi-provider WhatsApp integration system with AI-powered commercial analysis. The QR code functionality is partially implemented via Evolution API but requires hardening for production use, particularly around error handling, token security, connection status management, and provider conflict resolution.

The codebase is well-structured with clear separation of concerns (Server Actions, API Routes, Client Components, Utilities), but the WhatsApp integration layer would benefit from:
1. Enhanced error handling & logging
2. Token encryption & rotation
3. Connection health monitoring
4. Provider management UI
5. Comprehensive testing & validation

Current state: **MVP-ready** (core functionality works)  
Production-ready: **80-90%** (needs hardening in areas listed above)
