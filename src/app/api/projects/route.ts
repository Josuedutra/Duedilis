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
      memberships: {
        some: { userId: session.user.id },
      },
    },
    include: {
      org: { select: { id: true, name: true, slug: true } },
      _count: { select: { memberships: true } },
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
  const { orgId, name, slug, description, address, startDate, endDate } = body;

  if (!orgId || !name || !slug) {
    return NextResponse.json(
      { error: "orgId, name and slug are required" },
      { status: 400 },
    );
  }

  // Verify the user is an ADMIN_ORG or GESTOR_PROJETO in this org
  const membership = await prisma.orgMembership.findUnique({
    where: {
      userId_orgId: { userId: session.user.id, orgId },
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
      orgId,
      name,
      slug,
      description,
      address,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      memberships: {
        create: { userId: session.user.id, orgId, role: "GESTOR_PROJETO" },
      },
    },
    include: {
      org: { select: { id: true, name: true } },
      _count: { select: { memberships: true } },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
