export type OutboundMediaType = "image" | "audio" | "video" | "document";

const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
  rar: "application/vnd.rar",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  webm: "video/webm",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4a: "audio/mp4",
};

const WHATSAPP_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const WHATSAPP_AUDIO_MIME_TYPES = new Set(["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg", "audio/opus", "audio/wav", "audio/webm"]);
const WHATSAPP_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/3gpp"]);

const STORAGE_SAFE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/octet-stream",
]);

export function cleanOutboundMimeType(value: unknown) {
  const clean = String(value || "application/octet-stream").split(";")[0]?.trim().toLowerCase();
  return clean || "application/octet-stream";
}

export function inferOutboundMimeType(fileName: string | null | undefined, mimeType: unknown) {
  const clean = cleanOutboundMimeType(mimeType);
  if (clean && clean !== "application/octet-stream") return clean;

  const ext = String(fileName || "").toLowerCase().split(".").pop() || "";
  return EXTENSION_MIME_TYPES[ext] || "application/octet-stream";
}

export function normalizeOutboundMediaType(mediatype: unknown, mimetype: unknown): OutboundMediaType {
  const requested = String(mediatype || "").toLowerCase();
  const cleanMime = cleanOutboundMimeType(mimetype);

  if (requested === "image" || (!requested && cleanMime.startsWith("image/"))) {
    return WHATSAPP_IMAGE_MIME_TYPES.has(cleanMime) ? "image" : "document";
  }

  if (requested === "audio" || (!requested && cleanMime.startsWith("audio/"))) {
    return WHATSAPP_AUDIO_MIME_TYPES.has(cleanMime) ? "audio" : "document";
  }

  if (requested === "video" || (!requested && cleanMime.startsWith("video/"))) {
    return WHATSAPP_VIDEO_MIME_TYPES.has(cleanMime) ? "video" : "document";
  }

  return "document";
}

export function getStorageUploadMimeType(mimeType: unknown) {
  const clean = cleanOutboundMimeType(mimeType);
  return STORAGE_SAFE_MIME_TYPES.has(clean) ? clean : "application/octet-stream";
}

export function getDocumentSendMimeType(mimeType: unknown) {
  const clean = cleanOutboundMimeType(mimeType);
  return clean || "application/octet-stream";
}

export function normalizeOutboundMediaInput(input: {
  fileName?: string | null;
  mediatype?: unknown;
  mimetype?: unknown;
}) {
  const mimetype = inferOutboundMimeType(input.fileName, input.mimetype);
  const mediatype = normalizeOutboundMediaType(input.mediatype, mimetype);
  return {
    mediatype,
    mimetype: mediatype === "document" ? getDocumentSendMimeType(mimetype) : mimetype,
    storageMimeType: getStorageUploadMimeType(mimetype),
  };
}
