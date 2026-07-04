-- Backfill common Brazilian phone identity variations for existing contacts.
-- Conflicting identities are intentionally ignored; the admin merge tool resolves historical duplicates.
WITH normalized_contacts AS (
  SELECT
    "id",
    "organizationId",
    regexp_replace("phone", '\D', '', 'g') AS phone
  FROM "Contact"
), phone_values AS (
  SELECT "id", "organizationId", phone AS value
  FROM normalized_contacts
  WHERE phone <> ''

  UNION

  SELECT "id", "organizationId", '55' || phone AS value
  FROM normalized_contacts
  WHERE phone !~ '^55' AND length(phone) IN (10, 11)

  UNION

  SELECT "id", "organizationId", substring(phone from 3) AS value
  FROM normalized_contacts
  WHERE phone ~ '^55' AND length(phone) IN (12, 13)

  UNION

  SELECT "id", "organizationId", '55' || substring(phone from 1 for 2) || substring(phone from 4) AS value
  FROM normalized_contacts
  WHERE phone !~ '^55' AND length(phone) = 11 AND substring(phone from 3 for 1) = '9'

  UNION

  SELECT "id", "organizationId", substring(phone from 1 for 2) || substring(phone from 4) AS value
  FROM normalized_contacts
  WHERE phone !~ '^55' AND length(phone) = 11 AND substring(phone from 3 for 1) = '9'

  UNION

  SELECT "id", "organizationId", '55' || substring(phone from 1 for 2) || '9' || substring(phone from 3) AS value
  FROM normalized_contacts
  WHERE phone !~ '^55' AND length(phone) = 10

  UNION

  SELECT "id", "organizationId", substring(phone from 1 for 2) || '9' || substring(phone from 3) AS value
  FROM normalized_contacts
  WHERE phone !~ '^55' AND length(phone) = 10

  UNION

  SELECT "id", "organizationId", '55' || substring(phone from 3 for 2) || substring(phone from 6) AS value
  FROM normalized_contacts
  WHERE phone ~ '^55' AND length(phone) = 13 AND substring(phone from 5 for 1) = '9'

  UNION

  SELECT "id", "organizationId", substring(phone from 3 for 2) || substring(phone from 6) AS value
  FROM normalized_contacts
  WHERE phone ~ '^55' AND length(phone) = 13 AND substring(phone from 5 for 1) = '9'

  UNION

  SELECT "id", "organizationId", '55' || substring(phone from 3 for 2) || '9' || substring(phone from 5) AS value
  FROM normalized_contacts
  WHERE phone ~ '^55' AND length(phone) = 12

  UNION

  SELECT "id", "organizationId", substring(phone from 3 for 2) || '9' || substring(phone from 5) AS value
  FROM normalized_contacts
  WHERE phone ~ '^55' AND length(phone) = 12
)
INSERT INTO "ContactIdentity" ("id", "organizationId", "contactId", "type", "value")
SELECT concat('ci_', md5("organizationId" || ':PHONE:' || value)), "organizationId", "id", 'PHONE', value
FROM phone_values
WHERE value <> ''
ON CONFLICT ("organizationId", "type", "value") DO NOTHING;
