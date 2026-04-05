/**
 * Vercel Cron — SLA Check
 * Task: gov-1775322191896-u13dfj
 *
 * Evaluates all active SLA records periodically.
 * Cron schedule: every 15 minutes (see vercel.json)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateSlaStatus } from "@/lib/cde/sla-engine";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeSlas = await prisma.slaRecord.findMany({
    where: {
      status: { in: ["ON_TRACK", "WARNING", "CRITICAL"] },
    },
    select: { id: true },
  });

  const results = await Promise.allSettled(
    activeSlas.map((sla) => calculateSlaStatus(sla.id)),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    evaluated: activeSlas.length,
    succeeded,
    failed,
  });
}
