/**
 * GET  /api/cde/transmittals?orgId=&projectId= — list transmittals
 * POST /api/cde/transmittals — create transmittal
 *
 * Task: gov-1775322222005-pcvmpa (D4-09v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  createTransmittal,
  listTransmittals,
} from "@/lib/actions/transmittal-actions";

const CreateTransmittalSchema = z.object({
  orgId: z.string().min(1),
  projectId: z.string().min(1),
  subject: z.string().min(1),
  notes: z.string().optional(),
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

  try {
    const transmittals = await listTransmittals({ orgId, projectId });
    return NextResponse.json(transmittals);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateTransmittalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.errors },
      { status: 400 },
    );
  }

  try {
    const transmittal = await createTransmittal(parsed.data);
    return NextResponse.json(transmittal, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    if (/forbidden|403/i.test(msg))
      return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
