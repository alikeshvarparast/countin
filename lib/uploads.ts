import fs from "node:fs";
import path from "node:path";

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const UPLOAD_FOLDERS = ["users", "communities"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export function uploadsRoot() {
  return path.join(process.cwd(), "data", "uploads");
}

function publicUploadsRoot() {
  return path.join(process.cwd(), "public", "uploads");
}

function sniffExt(buffer: Buffer, mime: string, filename: string): string | null {
  const fromMime = ALLOWED_MIME[mime.toLowerCase().split(";")[0].trim()];
  if (fromMime) return fromMime;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  return null;
}

let migrated = false;

export function migrateLegacyUploads() {
  if (migrated) return;
  migrated = true;
  const legacy = path.join(process.cwd(), "public", "uploads");
  const dest = uploadsRoot();
  if (!fs.existsSync(legacy)) return;
  for (const folder of UPLOAD_FOLDERS) {
    const fromDir = path.join(legacy, folder);
    if (!fs.existsSync(fromDir)) continue;
    const toDir = path.join(dest, folder);
    fs.mkdirSync(toDir, { recursive: true });
    for (const name of fs.readdirSync(fromDir)) {
      const from = path.join(fromDir, name);
      const to = path.join(toDir, name);
      if (!fs.statSync(from).isFile()) continue;
      if (!fs.existsSync(to)) fs.copyFileSync(from, to);
    }
  }
}

export async function saveImageUpload(
  value: FormDataEntryValue | File | null,
  folder: UploadFolder,
  id: string,
) {
  migrateLegacyUploads();
  if (!value || typeof value === "string") return null;
  const file = value as Blob & { name?: string };
  if (!file.size) return null;
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Image must be under 2MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = sniffExt(buffer, file.type ?? "", file.name ?? "");
  if (!ext) {
    throw new Error("Use a JPG, PNG, or WebP image.");
  }
  const dir = path.join(uploadsRoot(), folder);
  fs.mkdirSync(dir, { recursive: true });
  purgeUploadsFor(folder, id);
  const filename = `${id}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}

function purgeUploadsFor(folder: UploadFolder, id: string) {
  for (const root of [uploadsRoot(), publicUploadsRoot()]) {
    const dir = path.join(root, folder);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const same = name === `${id}.jpg` || name === `${id}.jpeg` || name === `${id}.png` || name === `${id}.webp`;
      const versioned = name.startsWith(`${id}-`);
      if (!same && !versioned) continue;
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {
        /* ignore */
      }
    }
  }
}

function safeFileIn(rootDir: string, folder: string, filename: string) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(path.join(root, folder, filename));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  return resolved;
}

export function resolveUploadPath(folder: string, filename: string) {
  migrateLegacyUploads();
  const clean = filename.split("?")[0];
  if (!UPLOAD_FOLDERS.includes(folder as UploadFolder)) return null;
  if (!/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(clean)) return null;
  return safeFileIn(uploadsRoot(), folder, clean) ?? safeFileIn(publicUploadsRoot(), folder, clean);
}

export function contentTypeFor(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE[ext] ?? "application/octet-stream";
}
