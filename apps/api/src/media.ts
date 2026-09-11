/**
 * Media validation helpers.
 * Uploads are accepted only when their byte signature matches an allowlisted
 * type; the stored extension is chosen by the server, never by the client.
 */

export type MediaType = { mime: string; ext: string };

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

const ascii = (buf: Buffer, offset: number, length: number) =>
  buf.length >= offset + length ? buf.toString("latin1", offset, offset + length) : "";

export const detectMediaType = (buf: Buffer): MediaType | null => {
  if (!buf?.length) return null;
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: ".jpg" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: ".png" };
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return { mime: "image/gif", ext: ".gif" };
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 4) === "WEBP") return { mime: "image/webp", ext: ".webp" };
  if (ascii(buf, 0, 5) === "%PDF-") return { mime: "application/pdf", ext: ".pdf" };
  return null;
};

export const MEDIA_MAX_BYTES = (maxMb: number) => maxMb * 1024 * 1024;
