/**
 * PATCH /api/cde/staging/[stagingId] — validate / promote / reject staging document
 *
 * Task: gov-1775322197923-oc65nv (D4-06v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  validateStaging,
  promoteStaging,
  rejectStaging,
} from "@/lib/cde/staging";

const PatchStagingSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("validate") }),
  z.object({ action: z.literal("promote") }),
  z.object({ action: z.literal("reject"), reason: z.string().min(1) }),
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { stagingId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stagingId } = params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchStagingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { action } = parsed.data;

    if (action === "validate") {
      const result = await validateStaging({ stagingId });
      return NextResponse.json(result);
    }

    if (action === "promote") {
      const result = await promoteStaging({ stagingId });
      return NextResponse.json(result);
    }

    if (action === "reject") {
      const result = await rejectStaging({
        stagingId,
        reason: parsed.data.reason,
      });
      return NextResponse.json(result);
    }
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
