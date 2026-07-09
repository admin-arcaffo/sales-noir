import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { getStorageUploadMimeType } from "@/lib/outbound-media";

const LOCAL_MEDIA_DIR = path.join(process.cwd(), ".media");

type StoredMedia = {
  storageKey: string;
  mimeType: string;
  fileSize: number;
};

function autocorrectMimeType(buffer: Buffer, originalMime: string): string {
  if (buffer.length < 4) return originalMime;
  
  // PDF magic number: %PDF (25 50 44 46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }
  
  // JPEG magic number: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG magic number: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }

  // WEBP magic number: RIFF .... WEBP
  if (buffer.length >= 12 && 
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && 
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }

  return originalMime;
}

export function getMediaProxyUrl(messageId: string) {
  return `/api/media/${messageId}?raw=1`;
}

export function normalizeBase64Media(value: string) {
  const dataUriMatch = value.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (dataUriMatch) {
    return {
      mimeType: dataUriMatch[1],
      base64: dataUriMatch[2],
    };
  }

  return {
    mimeType: null,
    base64: value,
  };
}

export function mediaBufferFromBase64(value: string) {
  return Buffer.from(normalizeBase64Media(value).base64, "base64");
}

function getExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("pdf")) return "pdf";
  if (normalized.includes("wordprocessingml") || normalized.includes("msword")) return "docx";
  if (normalized.includes("spreadsheetml") || normalized.includes("ms-excel")) return "xlsx";
  if (normalized.includes("presentationml") || normalized.includes("ms-powerpoint")) return "pptx";
  if (normalized.includes("zip")) return "zip";
  if (normalized.includes("csv")) return "csv";
  if (normalized.includes("plain")) return "txt";
  return "bin";
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "whatsapp-media";

  if (!url || !key) return null;

  return {
    url: url.replace(/\/$/, ""),
    key,
    bucket,
  };
}

export function isSupabaseMediaStorageConfigured() {
  return Boolean(getSupabaseConfig());
}

function sanitizeStorageFileName(value: string | null | undefined) {
  const cleaned = (value || "media")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "media";
}

export function buildDirectUploadStorageKey(organizationId: string, mimeType: string, fileName?: string | null) {
  const safeName = sanitizeStorageFileName(fileName);
  const ext = safeName.includes(".") ? safeName.split(".").pop() : getExtension(mimeType);
  return `organizations/${organizationId}/outbound-uploads/${randomUUID()}.${ext || "bin"}`;
}

export function assertOrganizationStorageKey(organizationId: string, storageKey: string) {
  const expectedPrefix = `organizations/${organizationId}/`;
  if (!storageKey || storageKey.includes("..") || !storageKey.startsWith(expectedPrefix)) {
    throw new Error("Invalid media storage key");
  }
}

export async function createSignedMediaUploadUrl(input: {
  organizationId: string;
  mimeType: string;
  fileName?: string | null;
}) {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Media storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const storageKey = buildDirectUploadStorageKey(input.organizationId, input.mimeType, input.fileName);
  const uploadMimeType = getStorageUploadMimeType(input.mimeType);
  const response = await fetch(`${config.url}/storage/v1/object/upload/sign/${config.bucket}/${storageKey}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      "x-upsert": "false",
    },
    body: "{}",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Supabase signed upload failed (${response.status}): ${JSON.stringify(data)}`);
  }

  const rawSignedUrl = data?.signedUrl || data?.signedURL || data?.url;
  if (!rawSignedUrl) {
    throw new Error("Supabase signed upload did not return a URL");
  }

  const signedUrl = String(rawSignedUrl).startsWith("http")
    ? String(rawSignedUrl)
    : `${config.url}/storage/v1${rawSignedUrl}`;

  return {
    uploadUrl: signedUrl,
    storageKey,
    uploadMimeType,
    bucket: config.bucket,
  };
}

function buildStorageKey(organizationId: string, messageId: string, mimeType: string) {
  return `organizations/${organizationId}/messages/${messageId}/${randomUUID()}.${getExtension(mimeType)}`;
}

async function putSupabaseObject(storageKey: string, buffer: Buffer, mimeType: string) {
  const config = getSupabaseConfig();
  if (!config) return false;

  const uploadMimeType = getStorageUploadMimeType(mimeType);

  const upload = async (contentType: string) => {
    const response = await fetch(`${config.url}/storage/v1/object/${config.bucket}/${storageKey}`, {
      method: "PUT",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": contentType,
        "Content-Length": String(buffer.byteLength),
        "x-upsert": "true",
      },
      body: new Uint8Array(buffer),
    });

    if (response.ok) return null;

    const detail = await response.text().catch(() => "");
    return { status: response.status, detail, contentType };
  };

  const firstError = await upload(uploadMimeType);
  if (!firstError) return true;

  const shouldRetryAsBinary = uploadMimeType !== "application/octet-stream"
    && (firstError.status === 400 || firstError.status === 415 || firstError.detail.includes("invalid_mime_type"));

  if (shouldRetryAsBinary) {
    const fallbackError = await upload("application/octet-stream");
    if (!fallbackError) return true;
    throw new Error(`Supabase Storage upload failed (${fallbackError.status}) with fallback application/octet-stream: ${fallbackError.detail}`);
  }

  throw new Error(`Supabase Storage upload failed (${firstError.status}) with ${firstError.contentType}: ${firstError.detail}`);
}

async function getSupabaseObject(storageKey: string) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/storage/v1/object/${config.bucket}/${storageKey}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase Storage download failed (${response.status}): ${detail}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function putLocalObject(storageKey: string, buffer: Buffer) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Media storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in production.");
  }

  const filePath = path.join(LOCAL_MEDIA_DIR, storageKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
}

async function getLocalObject(storageKey: string) {
  const filePath = path.join(LOCAL_MEDIA_DIR, storageKey);
  return fs.readFile(filePath);
}

export async function storeMediaBuffer(input: {
  organizationId: string;
  messageId: string;
  buffer: Buffer;
  mimeType: string;
  originalUrl?: string | null;
}): Promise<StoredMedia> {
  const cleanMimeType = input.mimeType.split(";")[0].trim();
  const correctedMimeType = autocorrectMimeType(input.buffer, cleanMimeType);
  const storageKey = buildStorageKey(input.organizationId, input.messageId, correctedMimeType);
  
  let storedInSupabase = false;
  try {
    storedInSupabase = await putSupabaseObject(storageKey, input.buffer, correctedMimeType);
  } catch (error) {
    console.error(`[MEDIA STORAGE] Supabase upload failed for ${storageKey}:`, error);
  }

  if (!storedInSupabase) {
    await putLocalObject(storageKey, input.buffer);
  }

  return {
    storageKey,
    mimeType: correctedMimeType,
    fileSize: input.buffer.byteLength,
  };
}

export async function saveMessageMediaFromBuffer(input: {
  organizationId: string;
  messageId: string;
  buffer: Buffer;
  mimeType: string;
  originalUrl?: string | null;
  originalFileName?: string | null;
}) {
  const stored = await storeMediaBuffer(input);

  const media = await prisma.media.upsert({
    where: { messageId: input.messageId },
    update: {
      mimeType: stored.mimeType,
      fileSize: stored.fileSize,
      storageKey: stored.storageKey,
      originalUrl: input.originalUrl || null,
      originalFileName: input.originalFileName || null,
    },
    create: {
      messageId: input.messageId,
      mimeType: stored.mimeType,
      fileSize: stored.fileSize,
      storageKey: stored.storageKey,
      originalUrl: input.originalUrl || null,
      originalFileName: input.originalFileName || null,
    },
  });

  await prisma.message.update({
    where: { id: input.messageId },
    data: { mediaUrl: null, mediaStatus: 'AVAILABLE', mediaError: null },
  });

  return media;
}

export async function saveMessageMediaFromBase64(input: {
  organizationId: string;
  messageId: string;
  base64: string;
  mimeType: string;
  originalUrl?: string | null;
  originalFileName?: string | null;
}) {
  const normalized = normalizeBase64Media(input.base64);
  const mimeType = normalized.mimeType || input.mimeType;

  return saveMessageMediaFromBuffer({
    organizationId: input.organizationId,
    messageId: input.messageId,
    buffer: Buffer.from(normalized.base64, "base64"),
    mimeType,
    originalUrl: input.originalUrl || null,
    originalFileName: input.originalFileName || null,
  });
}

export async function readStoredMediaBuffer(storageKey: string) {
  try {
    const supabaseObject = await getSupabaseObject(storageKey);
    if (supabaseObject) return supabaseObject;
  } catch (error) {
    console.error(`[MEDIA STORAGE] Supabase download failed for ${storageKey}:`, error);
  }
  return getLocalObject(storageKey);
}

export async function readStoredMediaBase64(storageKey: string) {
  const buffer = await readStoredMediaBuffer(storageKey);
  return buffer.toString("base64");
}
