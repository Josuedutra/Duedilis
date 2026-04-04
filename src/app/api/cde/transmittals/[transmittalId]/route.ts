/**
 * GET   /api/cde/transmittals/[transmittalId]?orgId= — get transmittal detail
 * PATCH /api/cde/transmittals/[transmittalId] — send transmittal (action=send)
 *
 * Task: gov-1775322222005-pcvmpa (D4-09v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getTransmittalDetail,
  sendTransmittal,
} from "@/lib/actions/transmittal-actions";

const SendSchema = z.object({
  orgId: z.string().min(1),
  action: z.literal("send"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transmittalId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transmittalId } = await params;
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  try {
    const transmittal = await getTransmittalDetail({ orgId, transmittalId });
    return NextResponse.json(transmittal);
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

  const parsed = SendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.errors },
      { status: 400 },
    );
  }

  try {
    const transmittal = await sendTransmittal({
      orgId: parsed.data.orgId,
      transmittalId,
    });
    return NextResponse.json(transmittal);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    if (/already sent|já enviado|conflict|409/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 409 });
    if (/not found|404/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 404 });
    if (/forbidden|403/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
