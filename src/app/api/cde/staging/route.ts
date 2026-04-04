/**
 * GET  /api/cde/staging?orgId=&projectId= — list staging documents
 * POST /api/cde/staging — create staging document
 *
 * Task: gov-1775322197923-oc65nv (D4-06v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createStagingDocument } from "@/lib/cde/staging";
import { prisma } from "@/lib/prisma";

const CreateStagingSchema = z.object({
  originalName: z.string().min(1),
  orgId: z.string().min(1),
  projectId: z.string().min(1),
  folderId: z.string().min(1),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs = await (prisma as any).stagingDocument.findMany({
      where: { orgId, projectId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(docs);
  } catch (error) {
    console.error("GET /api/cde/staging error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
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

  const parsed = CreateStagingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const doc = await createStagingDocument({
      ...parsed.data,
      uploadedById: session.user.id,
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("POST /api/cde/staging error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
