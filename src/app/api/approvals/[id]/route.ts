/**
 * PATCH /api/approvals/[id]
 * Approve, reject, or cancel an approval.
 *
 * Body: { action: "approve" | "reject" | "cancel", note?: string }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  approveDocument,
  rejectApproval,
  cancelApproval,
} from "@/lib/actions/approval-actions";

const PatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), note: z.string().min(1) }),
  z.object({ action: z.literal("cancel") }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: approvalId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = parsed.data;

    if (data.action === "approve") {
      const result = await approveDocument({ approvalId });
      return NextResponse.json({ approval: result });
    }

    if (data.action === "reject") {
      const result = await rejectApproval({ approvalId, note: data.note });
      return NextResponse.json({ approval: result });
    }

    if (data.action === "cancel") {
      const result = await cancelApproval({ approvalId });
      return NextResponse.json({ approval: result });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.startsWith("403") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
