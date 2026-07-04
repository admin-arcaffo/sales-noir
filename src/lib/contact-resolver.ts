import prisma from "@/lib/prisma";
import { getBrazilianPhoneVariations } from "@/lib/phone";

export type ContactMergeInput = {
  organizationId: string;
  phone?: string | null;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  interestArea?: string | null;
  origin?: string | null;
  notes?: string | null;
  potentialValue?: number | null;
  monthlyRevenue?: number | null;
  mainChallenges?: string | null;
  address?: string | null;
  assignedUserId?: string | null;
  isLead?: boolean;
  source?: string;
};

export type ContactMergeConflict = { field: string; existing: unknown; incoming: unknown };

type MergeResult = {
  contact: any;
  created: boolean;
  changedFields: string[];
  conflicts: ContactMergeConflict[];
};

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string | null | undefined) {
  return cleanText(value)?.toLowerCase() || null;
}

export function normalizePhone(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

export function getPhoneIdentityValues(value: string | null | undefined) {
  const clean = normalizePhone(value);
  if (!clean) return [];
  return Array.from(new Set(getBrazilianPhoneVariations(clean)));
}

function canonicalPhone(value: string | null | undefined) {
  const values = getPhoneIdentityValues(value);
  return values.find((item) => item.startsWith("55")) || values[0] || normalizePhone(value);
}

function isGenericName(name: string | null | undefined, phoneValues: string[]) {
  const clean = cleanText(name);
  if (!clean) return true;
  const numeric = normalizePhone(clean);
  return Boolean(numeric && phoneValues.includes(numeric));
}

function sameText(a: unknown, b: unknown) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function appendBlock(existing: string | null, incoming: string, source: string) {
  if (!existing) return incoming;
  if (existing.toLowerCase().includes(incoming.toLowerCase())) return existing;
  const stamp = new Date().toLocaleDateString("pt-BR");
  return `${existing}\n\n[${source || "Importação"} - ${stamp}] ${incoming}`;
}

async function ensureIdentity(organizationId: string, contactId: string, type: "PHONE" | "EMAIL", value: string) {
  if (!value) return;
  await prisma.contactIdentity.upsert({
    where: { organizationId_type_value: { organizationId, type, value } },
    update: {},
    create: { organizationId, contactId, type, value },
  }).catch(() => null);
}

export async function ensureContactIdentities(input: { organizationId: string; contactId: string; phone?: string | null; email?: string | null }) {
  for (const phone of getPhoneIdentityValues(input.phone)) {
    await ensureIdentity(input.organizationId, input.contactId, "PHONE", phone);
  }
  const email = normalizeEmail(input.email);
  if (email) await ensureIdentity(input.organizationId, input.contactId, "EMAIL", email);
}

async function findContactByIdentity(organizationId: string, phone?: string | null, email?: string | null, backfill = true) {
  const phoneValues = getPhoneIdentityValues(phone);
  const emailValue = normalizeEmail(email);

  if (phoneValues.length === 0 && !emailValue) return null;

  const identity = await prisma.contactIdentity.findFirst({
    where: {
      organizationId,
      OR: [
        ...(phoneValues.length ? [{ type: "PHONE", value: { in: phoneValues } }] : []),
        ...(emailValue ? [{ type: "EMAIL", value: emailValue }] : []),
      ],
    },
    include: { contact: true },
  });
  if (identity?.contact) return identity.contact;

  const contact = await prisma.contact.findFirst({
    where: {
      organizationId,
      OR: [
        ...(phoneValues.length ? [{ phone: { in: phoneValues } }] : []),
        ...(emailValue ? [{ email: { equals: emailValue, mode: "insensitive" as const } }] : []),
      ],
    },
  });

  if (contact && backfill) {
    await ensureContactIdentities({ organizationId, contactId: contact.id, phone: contact.phone, email: contact.email });
    await ensureContactIdentities({ organizationId, contactId: contact.id, phone, email });
  }

  return contact;
}

function buildSafeUpdate(existing: any, incoming: ContactMergeInput, phoneValues: string[]): { data: Record<string, unknown>; changedFields: string[]; conflicts: MergeResult["conflicts"] } {
  const data: Record<string, unknown> = {};
  const changedFields: string[] = [];
  const conflicts: MergeResult["conflicts"] = [];
  const source = incoming.source || "Importação";

  const setIfEmpty = (field: keyof ContactMergeInput, value: unknown) => {
    if (value === null || value === undefined || value === "") return;
    const current = existing[field as string];
    if (current === null || current === undefined || current === "") {
      data[field as string] = value;
      changedFields.push(field as string);
    } else if (!sameText(current, value)) {
      conflicts.push({ field: field as string, existing: current, incoming: value });
    }
  };

  const name = cleanText(incoming.name);
  if (name && isGenericName(existing.name, phoneValues)) {
    data.name = name;
    changedFields.push("name");
  } else if (name && !sameText(existing.name, name)) {
    conflicts.push({ field: "name", existing: existing.name, incoming: name });
  }

  setIfEmpty("email", normalizeEmail(incoming.email));
  setIfEmpty("company", cleanText(incoming.company));
  setIfEmpty("interestArea", cleanText(incoming.interestArea));
  setIfEmpty("origin", cleanText(incoming.origin));
  setIfEmpty("address", cleanText(incoming.address));

  if (typeof incoming.potentialValue === "number" && Number.isFinite(incoming.potentialValue)) setIfEmpty("potentialValue", incoming.potentialValue);
  if (typeof incoming.monthlyRevenue === "number" && Number.isFinite(incoming.monthlyRevenue)) setIfEmpty("monthlyRevenue", incoming.monthlyRevenue);

  const notes = cleanText(incoming.notes);
  if (notes) {
    const next = appendBlock(existing.notes, notes, source);
    if (next !== existing.notes) {
      data.notes = next;
      changedFields.push("notes");
    }
  }

  const challenges = cleanText(incoming.mainChallenges);
  if (challenges) {
    const next = appendBlock(existing.mainChallenges, challenges, source);
    if (next !== existing.mainChallenges) {
      data.mainChallenges = next;
      changedFields.push("mainChallenges");
    }
  }

  if (!existing.assignedUserId && incoming.assignedUserId) {
    data.assignedUserId = incoming.assignedUserId;
    changedFields.push("assignedUserId");
  }
  if (incoming.isLead === true && existing.isLead !== true) {
    data.isLead = true;
    changedFields.push("isLead");
  }

  return { data, changedFields, conflicts };
}

export async function previewContactMerge(input: ContactMergeInput) {
  const phoneValues = getPhoneIdentityValues(input.phone);
  const contact = await findContactByIdentity(input.organizationId, input.phone, input.email, false);
  if (!contact) {
    return {
      contact: null,
      created: true,
      changedFields: [],
      conflicts: [] as ContactMergeConflict[],
    };
  }

  const merge = buildSafeUpdate(contact, input, phoneValues);
  return {
    contact,
    created: false,
    changedFields: merge.changedFields,
    conflicts: merge.conflicts,
  };
}

export async function resolveOrCreateContact(input: ContactMergeInput): Promise<MergeResult> {
  const phoneValues = getPhoneIdentityValues(input.phone);
  const phone = canonicalPhone(input.phone);
  const email = normalizeEmail(input.email);
  const name = cleanText(input.name) || phone || email || "Contato";

  let contact = await findContactByIdentity(input.organizationId, input.phone, input.email);
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        organizationId: input.organizationId,
        phone: phone || normalizePhone(input.phone) || "sem-telefone",
        name,
        email,
        company: cleanText(input.company),
        interestArea: cleanText(input.interestArea),
        origin: cleanText(input.origin),
        notes: cleanText(input.notes),
        potentialValue: typeof input.potentialValue === "number" && Number.isFinite(input.potentialValue) ? input.potentialValue : null,
        monthlyRevenue: typeof input.monthlyRevenue === "number" && Number.isFinite(input.monthlyRevenue) ? input.monthlyRevenue : null,
        mainChallenges: cleanText(input.mainChallenges),
        address: cleanText(input.address),
        assignedUserId: input.assignedUserId || null,
        isLead: input.isLead || false,
      },
    });
    await ensureContactIdentities({ organizationId: input.organizationId, contactId: contact.id, phone: input.phone || contact.phone, email });
    return { contact, created: true, changedFields: [], conflicts: [] };
  }

  const merge = buildSafeUpdate(contact, input, phoneValues);
  if (Object.keys(merge.data).length > 0) {
    contact = await prisma.contact.update({ where: { id: contact.id }, data: merge.data });
  }
  await ensureContactIdentities({ organizationId: input.organizationId, contactId: contact.id, phone: input.phone || contact.phone, email: input.email || contact.email });

  return { contact, created: false, changedFields: merge.changedFields, conflicts: merge.conflicts };
}
