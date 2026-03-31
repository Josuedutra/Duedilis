import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: {
      members: {
        some: { userId: session.user.id },
      },
    },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      _count: { select: { members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    organizationId,
    name,
    code,
    description,
    location,
    startDate,
    endDate,
  } = body;

  if (!organizationId || !name || !code) {
    return NextResponse.json(
      { error: "organizationId, name and code are required" },
      { status: 400 },
    );
  }

  // Verify the user is an ADMIN_ORG or GESTOR_PROJETO in this org
  const membership = await prisma.membership.findUnique({
    where: {
      organizationId_userId: { organizationId, userId: session.user.id },
    },
  });

  if (
    !membership ||
    !["ADMIN_ORG", "GESTOR_PROJETO"].includes(membership.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await prisma.project.create({
    data: {
      organizationId,
      name,
      code,
      description,
      location,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      members: {
        create: { userId: session.user.id, role: "GESTOR_PROJETO" },
      },
    },
    include: {
      organization: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
