/**
 * R2 service — Cloudflare R2 (S3-compatible) presigned URL generation
 * Sprint D2, Task: gov-1775041212811-idm9pz
 *
 * Env vars required:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */

import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const R2_PRESIGN_EXPIRY_SECONDS = 15 * 60; // 15 minutes

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 configuration missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY must be set",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function getR2BucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME environment variable is not set");
  }
  return bucket;
}

/**
 * Generate a presigned PUT URL for uploading directly to R2.
 * The URL expires in 15 minutes.
 */
export async function generatePresignedUploadUrl(params: {
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<{ uploadUrl: string; expiresAt: Date }> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.storageKey,
    ContentType: params.mimeType,
    ContentLength: params.fileSizeBytes,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: R2_PRESIGN_EXPIRY_SECONDS,
  });

  const expiresAt = new Date(Date.now() + R2_PRESIGN_EXPIRY_SECONDS * 1000);

  return { uploadUrl, expiresAt };
}
