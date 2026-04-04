/**
 * GET   /api/cde/changes/[changeId]?orgId= — get change detail
 * PATCH /api/cde/changes/[changeId] — transition status
 *
 * Task: gov-1775322214997-0n38ut (D4-08v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getChangeDetail,
  transitionChange,
} from "@/lib/actions/change-actions";

const TransitionSchema = z.object({
  orgId: z.string().min(1),
  toStatus: z.enum([
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "FORMALIZED",
    "CLOSED",
  ]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ changeId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { changeId } = await params;
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  try {
    const change = await getChangeDetail({ orgId, changeId });
    return NextResponse.json(change);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    if (/not found|404/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 404 });
    if (/forbidden|403/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ changeId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { changeId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = TransitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const updated = await transitionChange({
      orgId: parsed.data.orgId,
      changeId,
      toStatus: parsed.data.toStatus,
    });
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    if (/not found|404/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 404 });
    if (/forbidden|403/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
