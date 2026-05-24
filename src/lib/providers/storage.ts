import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Readable } from "node:stream";
import { env } from "@/lib/env";

export interface PutResult {
  key: string;          // opaque internal key — never serve directly
  encMeta: {
    alg: "aes-256-gcm";
    ivB64: string;
    tagB64: string;
    keyId: string;       // identifier of which app key encrypted this file
  };
  sizeBytes: number;
}

export interface StorageProvider {
  /** Encrypt + store. Returns the opaque key + the per-file envelope metadata. */
  put(rawKey: string, plain: Buffer, mime: string): Promise<PutResult>;
  /** Stream the decrypted plaintext. Caller must already be authorized. */
  getStream(key: string, encMeta: PutResult["encMeta"]): Promise<Readable>;
  delete(key: string): Promise<void>;
}

/** AES-256-GCM envelope with per-file random IV. App key sourced from env. */
function getMasterKey(): Buffer {
  const b64 = env().ENCRYPTION_KEY_B64;
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY_B64 must decode to 32 bytes (got ${key.length})`);
  }
  return key;
}

class LocalEncryptedStorage implements StorageProvider {
  constructor(private rootDir: string) {}

  private fullPath(key: string) {
    // key is the storage-layer identifier; never user-supplied path
    if (!/^[a-z0-9/_-]+$/i.test(key)) throw new Error("Invalid storage key");
    return path.join(this.rootDir, key);
  }

  async put(rawKey: string, plain: Buffer, _mime: string): Promise<PutResult> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", getMasterKey(), iv);
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    const dest = this.fullPath(rawKey);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, ct, { mode: 0o600 });
    return {
      key: rawKey,
      encMeta: {
        alg: "aes-256-gcm",
        ivB64: iv.toString("base64"),
        tagB64: tag.toString("base64"),
        keyId: "env:ENCRYPTION_KEY_B64",
      },
      sizeBytes: plain.byteLength,
    };
  }

  async getStream(key: string, encMeta: PutResult["encMeta"]): Promise<Readable> {
    const iv = Buffer.from(encMeta.ivB64, "base64");
    const tag = Buffer.from(encMeta.tagB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getMasterKey(), iv);
    decipher.setAuthTag(tag);
    const fileStream = createReadStream(this.fullPath(key));
    // Pipe ciphertext through the decipher transform.
    return fileStream.pipe(decipher);
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.fullPath(key), { force: true });
  }
}

let cached: StorageProvider | undefined;

export function storage(): StorageProvider {
  if (cached) return cached;
  const e = env();
  let next: StorageProvider;
  if (e.STORAGE_DRIVER === "s3") {
    // Lazy-load S3 adapter so local boots don't pay the SDK cost
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3EncryptedStorage } = require("./storage.s3") as typeof import("./storage.s3");
    next = new S3EncryptedStorage();
  } else {
    next = new LocalEncryptedStorage(e.STORAGE_LOCAL_DIR);
  }
  cached = next;
  return next;
}
