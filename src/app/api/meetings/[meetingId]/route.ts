import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  updateMeeting,
  addParticipant,
  createMinutes,
  publishMinutes,
  startMeeting,
  endMeeting,
  cancelMeeting,
} from "@/lib/actions/meeting-actions";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

interface RouteContext {
  params: Promise<{ meetingId: string }>;
}

/**
 * GET /api/meetings/[meetingId]
 * Detalhes da reunião com participants + minutes + actionItems
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { meetingId } = await params;

  try {
    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: true,
        minutes: true,
        actionItems: {
          orderBy: { dueDate: "asc" },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // RLS: verify user belongs to the org
    const membership = await prisma.orgMembership.findUnique({
      where: {
        userId_orgId: {
          userId: session.user.id,
          orgId: meeting.orgId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ meeting });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/meetings/[meetingId]
 * Actualiza meeting (título, data, local, estado)
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { meetingId } = await params;
  const body = await request.json();
  const { title, description, location, scheduledAt, action } = body;

  try {
    // Handle state transitions via action field
    if (action === "start") {
      const updated = await startMeeting({ meetingId });
      return NextResponse.json({ meeting: updated });
    }
    if (action === "end") {
      const updated = await endMeeting({ meetingId });
      return NextResponse.json({ meeting: updated });
    }
    if (action === "cancel") {
      const updated = await cancelMeeting({ meetingId });
      return NextResponse.json({ meeting: updated });
    }

    // Regular field update
    const meeting = await updateMeeting({
      meetingId,
      title,
      description,
      location,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    });
    return NextResponse.json({ meeting });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("403")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message.includes("404")) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/meetings/[meetingId]
 * Subactions: add participant, create/publish minutes
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { meetingId } = await params;
  const body = await request.json();
  const { action } = body;

  try {
    if (action === "add-participant") {
      const { orgId, userId, name, email, role } = body;
      if (!orgId || !name) {
        return NextResponse.json(
          { error: "orgId and name are required" },
          { status: 400 },
        );
      }
      const participant = await addParticipant({
        meetingId,
        orgId,
        userId,
        name,
        email,
        role,
      });
      return NextResponse.json({ participant }, { status: 201 });
    }

    if (action === "create-minutes") {
      const { content } = body;
      if (!content) {
        return NextResponse.json(
          { error: "content is required" },
          { status: 400 },
        );
      }
      const minutes = await createMinutes({ meetingId, content });
      return NextResponse.json({ minutes }, { status: 201 });
    }

    if (action === "publish-minutes") {
      const { minutesId } = body;
      if (!minutesId) {
        return NextResponse.json(
          { error: "minutesId is required" },
          { status: 400 },
        );
      }
      const minutes = await publishMinutes({ minutesId });
      return NextResponse.json({ minutes });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("403")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message.includes("404")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
