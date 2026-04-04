/**
 * GET  /api/cde/changes?orgId=&projectId=&type=&status= — list changes/claims
 * POST /api/cde/changes — create change/claim record
 *
 * Task: gov-1775322214997-0n38ut (D4-08v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createChange, listChanges } from "@/lib/actions/change-actions";

const CreateChangeSchema = z.object({
  orgId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["ALTERATION", "CLAIM"]),
  financialImpact: z.number().positive().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  const projectId = searchParams.get("projectId");

  if (!orgId || !projectId) {
    return NextResponse.json(
      { error: "orgId and projectId are required" },
      { status: 400 },
    );
  }

  const type = searchParams.get("type") as "ALTERATION" | "CLAIM" | null;
  const status = searchParams.get("status") as string | null;

  try {
    const changes = await listChanges({
      orgId,
      projectId,
      ...(type ? { type } : {}),
      ...(status ? { status: status as never } : {}),
    });
    return NextResponse.json(changes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    if (/forbidden|403/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const change = await createChange(parsed.data);
    return NextResponse.json(change, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    if (/forbidden|403/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
