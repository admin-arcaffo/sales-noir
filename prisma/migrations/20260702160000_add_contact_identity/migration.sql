-- Store normalized contact identities to avoid duplicates across phone/e-mail variants.
CREATE TABLE "ContactIdentity" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ContactIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactIdentity_organizationId_type_value_key" ON "ContactIdentity"("organizationId", "type", "value");
CREATE INDEX "ContactIdentity_contactId_idx" ON "ContactIdentity"("contactId");

ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill exact phones and emails for existing contacts.
INSERT INTO "ContactIdentity" ("id", "organizationId", "contactId", "type", "value")
SELECT concat('ci_', md5("organizationId" || ':PHONE:' || regexp_replace("phone", '\\D', '', 'g'))), "organizationId", "id", 'PHONE', regexp_replace("phone", '\\D', '', 'g')
FROM "Contact"
WHERE regexp_replace("phone", '\\D', '', 'g') <> ''
ON CONFLICT ("organizationId", "type", "value") DO NOTHING;

INSERT INTO "ContactIdentity" ("id", "organizationId", "contactId", "type", "value")
SELECT concat('ci_', md5("organizationId" || ':EMAIL:' || lower(trim("email")))), "organizationId", "id", 'EMAIL', lower(trim("email"))
FROM "Contact"
WHERE "email" IS NOT NULL AND lower(trim("email")) <> ''
ON CONFLICT ("organizationId", "type", "value") DO NOTHING;
