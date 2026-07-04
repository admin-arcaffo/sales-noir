CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId");

CREATE INDEX IF NOT EXISTS "WhatsAppConnection_organizationId_userId_provider_idx" ON "WhatsAppConnection"("organizationId", "userId", "provider");
CREATE INDEX IF NOT EXISTS "WhatsAppConnection_org_provider_status_active_idx" ON "WhatsAppConnection"("organizationId", "provider", "status", "isActive");
CREATE INDEX IF NOT EXISTS "WhatsAppConnection_phoneNumberId_status_idx" ON "WhatsAppConnection"("phoneNumberId", "status");

CREATE INDEX IF NOT EXISTS "Contact_organizationId_isLead_updatedAt_idx" ON "Contact"("organizationId", "isLead", "updatedAt");
CREATE INDEX IF NOT EXISTS "Contact_organizationId_assignedUserId_idx" ON "Contact"("organizationId", "assignedUserId");

CREATE INDEX IF NOT EXISTS "Product_organizationId_name_idx" ON "Product"("organizationId", "name");

CREATE INDEX IF NOT EXISTS "ContactProduct_contactId_idx" ON "ContactProduct"("contactId");
CREATE INDEX IF NOT EXISTS "ContactProduct_productId_idx" ON "ContactProduct"("productId");

CREATE INDEX IF NOT EXISTS "PipelineStage_organizationId_order_idx" ON "PipelineStage"("organizationId", "order");

CREATE INDEX IF NOT EXISTS "Conversation_contactId_status_updatedAt_idx" ON "Conversation"("contactId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Conversation_connection_lastMessage_updatedAt_idx" ON "Conversation"("whatsAppConnectionId", "lastMessageAt", "updatedAt");
CREATE INDEX IF NOT EXISTS "Conversation_connection_status_lastMessage_idx" ON "Conversation"("whatsAppConnectionId", "status", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "Conversation_stage_idx" ON "Conversation"("stage");
CREATE INDEX IF NOT EXISTS "Conversation_temperature_idx" ON "Conversation"("temperature");

CREATE INDEX IF NOT EXISTS "Message_conversationId_timestamp_idx" ON "Message"("conversationId", "timestamp");

CREATE INDEX IF NOT EXISTS "AIAnalysis_conversationId_createdAt_idx" ON "AIAnalysis"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AIAnalysis_userId_createdAt_idx" ON "AIAnalysis"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "PromptTemplate_org_category_active_version_updatedAt_idx" ON "PromptTemplate"("organizationId", "category", "isActive", "version", "updatedAt");

CREATE INDEX IF NOT EXISTS "IntegrationLog_connectionId_createdAt_idx" ON "IntegrationLog"("connectionId", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "ScheduledMessage_status_scheduledFor_idx" ON "ScheduledMessage"("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "ScheduledMessage_conversationId_status_idx" ON "ScheduledMessage"("conversationId", "status");

CREATE INDEX IF NOT EXISTS "Meeting_organizationId_scheduledAt_idx" ON "Meeting"("organizationId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "Meeting_closerId_scheduledAt_idx" ON "Meeting"("closerId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "Meeting_contactId_scheduledAt_idx" ON "Meeting"("contactId", "scheduledAt");
