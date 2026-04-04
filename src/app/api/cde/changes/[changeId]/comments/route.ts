/**
 * GET  /api/cde/changes/[changeId]/comments?orgId= — list comments (immutable)
 * POST /api/cde/changes/[changeId]/comments — add comment (immutable, no edit/delete)
 *
 * Task: gov-1775322214997-0n38ut (D4-08v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { addChangeComment } from "@/lib/actions/change-actions";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const AddCommentSchema = z.object({
  orgId: z.string().min(1),
  body: z.string().min(1),
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

  const comments = await db.changeComment.findMany({
    where: { changeId },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(comments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ changeId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { changeId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = AddCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const comment = await addChangeComment({
      orgId: parsed.data.orgId,
      changeId,
      body: parsed.data.body,
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    if (/not found|404/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 404 });
    if (/forbidden|403/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
