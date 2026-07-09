export type WhatsAppJidKind = "personal" | "group" | "broadcast" | "newsletter" | "lid" | "unknown";

export type ParsedWhatsAppJid = {
  raw: string;
  kind: WhatsAppJidKind;
  domain: string | null;
  local: string | null;
  phone: string | null;
  isPersonal: boolean;
  reason: string | null;
};

function isPlausibleWhatsAppPhone(value: string) {
  if (!/^\d{8,15}$/.test(value)) return false;
  if (/^(\d)\1+$/.test(value)) return false;
  if (value.startsWith("0")) return false;
  return true;
}

function splitJid(value: string) {
  const atIndex = value.indexOf("@");
  if (atIndex === -1) {
    return { local: value, domain: "" };
  }

  return {
    local: value.slice(0, atIndex),
    domain: value.slice(atIndex + 1).toLowerCase(),
  };
}

export function parseWhatsAppJid(value: unknown): ParsedWhatsAppJid {
  const raw = String(value || "").trim();
  if (!raw) {
    return { raw, kind: "unknown", domain: null, local: null, phone: null, isPersonal: false, reason: "missing_jid" };
  }

  const { local: rawLocal, domain } = splitJid(raw.toLowerCase());
  const local = rawLocal.split(":")[0];

  if (!domain) {
    return { raw, kind: "unknown", domain: null, local, phone: null, isPersonal: false, reason: "missing_domain" };
  }

  if (domain === "g.us") {
    return { raw, kind: "group", domain, local, phone: null, isPersonal: false, reason: "group_jid" };
  }

  if (domain === "broadcast" || raw.toLowerCase() === "status@broadcast") {
    return { raw, kind: "broadcast", domain, local, phone: null, isPersonal: false, reason: "broadcast_jid" };
  }

  if (domain === "newsletter") {
    return { raw, kind: "newsletter", domain, local, phone: null, isPersonal: false, reason: "newsletter_jid" };
  }

  if (domain === "lid") {
    return { raw, kind: "lid", domain, local, phone: null, isPersonal: false, reason: "lid_without_phone" };
  }

  if (domain !== "s.whatsapp.net" && domain !== "c.us") {
    return { raw, kind: "unknown", domain, local, phone: null, isPersonal: false, reason: "unsupported_domain" };
  }

  const phone = local.replace(/\D/g, "");
  if (!isPlausibleWhatsAppPhone(phone)) {
    return { raw, kind: "personal", domain, local, phone: null, isPersonal: false, reason: "invalid_personal_phone" };
  }

  return { raw, kind: "personal", domain, local, phone, isPersonal: true, reason: null };
}

export function isGenericNumericContactName(name: string | null | undefined, phone: string | null | undefined) {
  const cleanName = String(name || "").replace(/\D/g, "");
  const cleanPhone = String(phone || "").replace(/\D/g, "");
  return Boolean(cleanName && cleanPhone && cleanName === cleanPhone);
}
