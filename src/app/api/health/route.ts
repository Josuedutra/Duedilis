/**
 * Health check endpoint — E8-02 Observabilidade
 * Task: gov-1775077805718-4normj
 *
 * GET /api/health
 * Returns 200 with status "healthy" or 503 with status "degraded"
 */

import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";

type CheckResult = boolean | string;

interface HealthChecks {
  db: CheckResult;
  r2: CheckResult;
  version: string;
  timestamp: string;
}

async function checkDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkR2(): Promise<boolean> {
  try {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      // R2 not configured — treat as not applicable rather than failure
      return true;
    }

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const checks: HealthChecks = {
    db: await checkDb(),
    r2: await checkR2(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    timestamp: new Date().toISOString(),
  };

  const isHealthy = checks.db === true && checks.r2 === true;

  const status = isHealthy ? "healthy" : "degraded";

  return Response.json({ status, checks }, { status: isHealthy ? 200 : 503 });
}
