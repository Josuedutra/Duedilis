/**
 * GET    /api/photos/[id] — get photo detail
 * DELETE /api/photos/[id] — delete photo
 *
 * Sprint D2, Task gov-1775041297153-uzp0s2
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deletePhoto } from "@/lib/actions/photo-actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const photo = await db.evidence.findFirst({
    where: {
      id,
      type: "FOTO",
      org: {
        memberships: { some: { userId: session.user.id } },
      },
    },
    include: {
      issue: {
        select: { id: true, title: true, projectId: true },
      },
    },
  });

  if (!photo) {
    return NextResponse.json({ error: "Foto não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ photo });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get orgId from photo before deleting
  const photo = await db.evidence.findFirst({
    where: { id, type: "FOTO" },
    select: { orgId: true },
  });

  if (!photo) {
    return NextResponse.json({ error: "Foto não encontrada" }, { status: 404 });
  }

  try {
    const result = await deletePhoto({ photoId: id, orgId: photo.orgId });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
