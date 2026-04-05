/**
 * POST /api/cde/transmittals/[transmittalId]/documents — add documents to transmittal
 *
 * Task: gov-1775322222005-pcvmpa (D4-09v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { addDocumentsToTransmittal } from "@/lib/actions/transmittal-actions";

const AddDocumentsSchema = z.object({
  orgId: z.string().min(1),
  documentIds: z.array(z.string().min(1)).min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ transmittalId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transmittalId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AddDocumentsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const docs = await addDocumentsToTransmittal({
      orgId: parsed.data.orgId,
      transmittalId,
      documentIds: parsed.data.documentIds,
    });
    return NextResponse.json(docs, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    if (/conflict|409|duplicate/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 409 });
    if (/not found|404/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 404 });
    if (/forbidden|403/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
