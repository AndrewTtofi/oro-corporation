import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "node:crypto";
import type { Readable } from "node:stream";
import { env } from "@/lib/env";
import type { StorageProvider, PutResult } from "./storage";

/**
 * S3-compatible encrypted storage. Works with R2, MinIO, or AWS S3.
 * Activated via STORAGE_DRIVER=s3 — never required for local boot.
 */
export class S3EncryptedStorage implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const e = env();
    if (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) {
      throw new Error("S3 driver selected but S3_* env vars are not set");
    }
    this.bucket = e.S3_BUCKET;
    this.client = new S3Client({
      region: e.S3_REGION ?? "auto",
      endpoint: e.S3_ENDPOINT,
      forcePathStyle: e.S3_FORCE_PATH_STYLE ?? !!e.S3_ENDPOINT,
      credentials: {
        accessKeyId: e.S3_ACCESS_KEY_ID,
        secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  private masterKey(): Buffer {
    const k = Buffer.from(env().ENCRYPTION_KEY_B64, "base64");
    if (k.length !== 32) throw new Error("ENCRYPTION_KEY_B64 must decode to 32 bytes");
    return k;
  }

  async put(rawKey: string, plain: Buffer): Promise<PutResult> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.masterKey(), iv);
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: rawKey,
      Body: ct,
    }));
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
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!out.Body) throw new Error(`No body for ${key}`);
    const iv = Buffer.from(encMeta.ivB64, "base64");
    const tag = Buffer.from(encMeta.tagB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.masterKey(), iv);
    decipher.setAuthTag(tag);
    return (out.Body as Readable).pipe(decipher);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
