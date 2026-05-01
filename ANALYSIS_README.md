# Sales Noir - Codebase Analysis - READ ME FIRST

## 📋 What's in This Directory?

This analysis package contains three comprehensive documents about the Sales Noir codebase:

1. **CODEBASE_ANALYSIS.md** (30KB) - FULL DETAILED ANALYSIS
   - Complete project overview
   - All features and functionality
   - Architecture diagrams
   - Database schema documentation
   - All critical issues and warnings
   - Recommended roadmap
   - File manifest

2. **QR_CODE_ARCHITECTURE.md** - WHATSAPP QR CODE DEEP DIVE
   - System architecture diagrams
   - Message flow after QR code scan
   - Database schema details
   - Error handling strategies
   - Security considerations
   - Testing checklist
   - Deployment steps

3. **QUICK_SUMMARY.txt** - ONE-PAGE REFERENCE
   - Project overview
   - Core features summary
   - WhatsApp QR functionality
   - Key strengths
   - Critical issues
   - Required environment variables
   - Next steps (prioritized)

---

## 🎯 Quick Navigation

### For Project Managers
Start with: **QUICK_SUMMARY.txt**
- Get the 5-minute overview
- Understand current state vs. production-ready
- See critical vs. nice-to-have improvements

### For Developers Implementing QR Code
Start with: **QR_CODE_ARCHITECTURE.md**
- Understand the complete message flow
- See what needs to be fixed
- Follow testing checklist
- Use deployment steps

### For Full Context
Start with: **CODEBASE_ANALYSIS.md**
- Comprehensive reference document
- All pages, components, API routes listed
- Database schema fully documented
- Integration points explained
- 5-phase improvement roadmap

---

## 📊 Project Status Summary

**Current State:** MVP-ready (core QR code functionality works)
**Production Readiness:** 80-90% (needs hardening)
**Risk Level:** MEDIUM (security and reliability issues identified)

### What Works ✓
- WhatsApp message receiving via webhooks
- QR code generation and display
- Database storage of conversations
- AI-powered analysis of messages
- Audio transcription (Whisper)
- Multi-organization support
- Clean, type-safe codebase

### What Needs Fixing 🔧
- Token encryption at rest
- Webhook signature verification
- Connection health monitoring
- QR code expiry detection
- Rate limiting on instance creation
- Error handling & logging
- Instance disconnect functionality

---

## 🚀 Quick Reference - Key Files

### WhatsApp QR Code Implementation
- **Component:** `/src/app/(app)/settings/_components/WhatsAppQR.tsx`
- **Server Actions:** `/src/actions/whatsapp.ts`
- **Evolution API Client:** `/src/lib/evolution.ts`
- **Webhook Handlers:** 
  - `/src/app/api/webhook/evolution/route.ts`
  - `/src/app/api/webhook/whatsapp/route.ts`

### CRM Core
- **Dashboard Data:** `/src/actions/crm.ts` (main operations)
- **Pages:** `/src/app/(app)/{dashboard,conversations,leads,tasks,settings}/`
- **Database:** `/prisma/schema.prisma`

### AI & Async
- **System Prompts:** `/src/lib/ai/prompts.ts`
- **Async Jobs:** `/src/inngest/functions.ts`
- **Job Client:** `/src/inngest/client.ts`

---

## 🔐 Critical Security Issues

### 🔴 High Priority
1. **Instance tokens stored in plaintext**
   - File: `prisma/schema.prisma` → `WhatsAppConnection.instanceToken`
   - Fix: Implement field-level encryption

2. **No webhook signature verification**
   - Files: `/src/app/api/webhook/{evolution,whatsapp}/route.ts`
   - Fix: Verify HMAC signature on each request

3. **No rate limiting**
   - File: `/src/actions/whatsapp.ts` → `createWhatsAppInstance()`
   - Fix: Add max 1 instance per org per day

### 🟠 Medium Priority
1. No instance connection status polling
2. QR code expiry not detected (expires in 60-120 seconds)
3. Missing error logging to database

---

## 🧪 Testing Checklist

Before going to production:
```
[ ] QR code generation works
[ ] QR code can be scanned on mobile
[ ] Message received after scan
[ ] Message appears in UI within 5 seconds
[ ] AI analysis appears within 30 seconds
[ ] Audio messages are transcribed
[ ] Multiple organizations don't cross-contaminate
[ ] Webhook handles high message volume
[ ] Token expiry doesn't crash app
[ ] Provider switching works (Meta + Evolution)
```

See **QR_CODE_ARCHITECTURE.md** for full testing checklist.

---

## 📈 Implementation Roadmap

### Phase 1: Security (Week 1)
- Encrypt instance tokens
- Add webhook signature verification
- Add rate limiting

### Phase 2: Reliability (Week 2)
- Connection status polling
- QR code expiry detection
- Error logging to database

### Phase 3: Features (Week 3)
- Disconnect/logout functionality
- Instance management UI
- Provider selection logic

### Phase 4: Production (Week 4)
- Load testing
- E2E testing
- Documentation

See **CODEBASE_ANALYSIS.md** Section 9 for detailed roadmap.

---

## 🛠 Tech Stack Reference

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 19.2.4 |
| **Framework** | Next.js | 16.2.4 |
| **Styling** | Tailwind CSS | 4.x |
| **Database** | PostgreSQL | (via Supabase) |
| **ORM** | Prisma | 5.14.0 |
| **Auth** | Clerk | 7.2.3 |
| **AI** | OpenAI | 6.34.0 |
| **Async Jobs** | Inngest | 4.2.4 |
| **Icons** | Lucide React | 1.8.0 |
| **Deployment** | Vercel | (recommended) |

---

## 📞 Key Environment Variables

```bash
# Must Configure for QR Code to Work:
EVOLUTION_API_URL=https://evolution-api.your-domain.com
EVOLUTION_API_KEY=your-api-key

NEXT_PUBLIC_APP_URL=https://yourdomain.com
# (or VERCEL_URL is auto-set)

# Database
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true

# AI
OPENAI_API_KEY=sk-...

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Inngest Jobs
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# Optional (for Meta API):
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_ACCESS_TOKEN=...
```

See **CODEBASE_ANALYSIS.md** Section 7.1 for complete list.

---

## 📊 Architecture at a Glance

```
Browser
  ↓
NextJS Server (Server Actions)
  ├─ /actions/whatsapp.ts (QR generation)
  ├─ /actions/crm.ts (CRM operations)
  └─ /api/webhook/ (Message receiving)
  ↓
PostgreSQL Database
  └─ 12 core tables + relationships
  ↓
External APIs
  ├─ Evolution API (QR code provider)
  ├─ Meta WhatsApp API (optional)
  ├─ OpenAI (GPT-4 analysis)
  ├─ Inngest (async jobs)
  └─ Clerk (authentication)
```

See **QR_CODE_ARCHITECTURE.md** for full system diagram.

---

## ✅ Database Tables (Quick Reference)

- **Organization** - Workspace owner
- **User** - Team member (Clerk sync)
- **Contact** - Lead/customer (from WhatsApp)
- **Conversation** - Chat thread
- **Message** - Individual message
- **AudioTranscript** - Whisper transcriptions
- **AIAnalysis** - AI conversation analysis
- **SuggestedReply** - AI-generated replies
- **Task** - Follow-up tasks
- **WhatsAppConnection** - API credentials storage
- **PromptTemplate** - AI system prompts
- **IntegrationLog** - API call logs
- **LeadStageHistory** - Stage tracking
- **AuditLog** - Activity log

See **CODEBASE_ANALYSIS.md** Section 6 for full schema.

---

## 🎨 UI Pages Overview

| Page | File | Purpose |
|------|------|---------|
| Dashboard | `/dashboard` | KPIs & recent activity |
| Conversations | `/conversations` | WhatsApp inbox |
| Leads | `/leads` | Lead pipeline |
| Tasks | `/tasks` | Task management |
| Settings | `/settings` | Config & QR code |

---

## 🔗 Integration Points

### Inbound (to our app)
- WhatsApp messages (via Evolution or Meta webhooks)
- Webhook URLs auto-configured
- Message deduplication by `waMessageId`

### Outbound (from our app)
- Send messages back to WhatsApp
- Call OpenAI for analysis
- Queue jobs with Inngest
- Store data in Prisma

See **QR_CODE_ARCHITECTURE.md** PHASE 2-5 for detailed flow.

---

## ❓ FAQ

**Q: Can I use Meta API and Evolution at the same time?**
A: Yes, but there's no UI to switch between them. See Critical Issue #4 in CODEBASE_ANALYSIS.md.

**Q: How long does QR code last?**
A: Typically 60-120 seconds. App doesn't detect expiry. See Critical Issue #3.

**Q: Where are tokens stored securely?**
A: They're currently NOT secure (plaintext in DB). This is Issue #1.

**Q: Can I rate-limit users creating instances?**
A: Not currently. See Critical Issue #5.

**Q: How do messages trigger AI analysis?**
A: Inngest async job is triggered. Takes 5-30 seconds. See PHASE 4 in QR_CODE_ARCHITECTURE.md.

---

## 📖 Document Map

```
You are here ← ANALYSIS_README.md (this file)
  ├── Start here for quick overview
  │
  ├─→ QUICK_SUMMARY.txt
  │   └── 1-page cheat sheet
  │
  ├─→ QR_CODE_ARCHITECTURE.md
  │   ├── System diagrams
  │   ├── Message flow details
  │   ├── Testing checklist
  │   └── Deployment guide
  │
  └─→ CODEBASE_ANALYSIS.md
      ├── Complete reference (11 sections)
      ├── All files listed
      ├── Database schema detailed
      ├── 8 critical issues documented
      ├── 5-phase roadmap
      └── Production readiness assessment
```

---

## 🤝 Support Resources

For more information about specific technologies:
- **Next.js 16:** Read AGENTS.md in project root
- **Prisma:** Run `prisma studio` to view database GUI
- **Evolution API:** Check `src/lib/evolution.ts` for client implementation
- **OpenAI Prompts:** See `src/lib/ai/prompts.ts`

---

## 📝 Last Updated

**Analysis Date:** April 30, 2026
**Codebase Version:** 0.1.0
**Framework:** Next.js 16 + React 19

---

## ⚠️ Disclaimer

This analysis is based on code review of the current repository state. Recommendations should be validated with the development team and tested thoroughly before implementation. Security issues identified should be addressed before production deployment.

---

**Ready to dive in? Pick a document above based on your role!**
