import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createMeeting, listMeetings } from "@/lib/actions/meeting-actions";

/**
 * GET /api/meetings?projectId=&orgId=
 * Lista reuniões de um projecto (RLS por orgId)
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const orgId = searchParams.get("orgId");
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  try {
    const meetings = await listMeetings({ orgId, projectId, page, pageSize });
    return NextResponse.json({ meetings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("403")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/meetings
 * Cria uma nova reunião
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { orgId, projectId, title, description, location, scheduledAt } = body;

  if (!orgId || !projectId || !title || !scheduledAt) {
    return NextResponse.json(
      { error: "orgId, projectId, title and scheduledAt are required" },
      { status: 400 },
    );
  }

  try {
    const meeting = await createMeeting({
      orgId,
      projectId,
      title,
      description,
      location,
      scheduledAt: new Date(scheduledAt),
    });
    return NextResponse.json({ meeting }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("403")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
