/**
 * CDE Documents page — Sprint D2-03/05/06
 * Task: gov-1775041228837-pj6dba
 *
 * Layout: sidebar árvore de pastas + main area com lista de documentos
 * Features: criar pasta (modal), navegação hierárquica, upload, versionamento, status machine
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CdePageClient } from "./cde-page-client";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ folderId?: string }>;
}

export default async function DocumentsPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id: projectId } = await params;
  const { folderId: activeFolderId } = await searchParams;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      org: { memberships: { some: { userId: session.user.id } } },
    },
    include: { org: { select: { id: true, name: true } } },
  });
  if (!project) notFound();

  const folders = await prisma.cdeFolder.findMany({
    where: { orgId: project.orgId, projectId },
    orderBy: { createdAt: "asc" },
  });

  const activeFolderIdResolved = activeFolderId ?? folders[0]?.id ?? null;

  const documents = activeFolderIdResolved
    ? await prisma.document.findMany({
        where: {
          orgId: project.orgId,
          folderId: activeFolderIdResolved,
        },
        include: { uploader: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const activeFolder = activeFolderIdResolved
    ? (folders.find((f) => f.id === activeFolderIdResolved) ?? null)
    : null;

  return (
    <CdePageClient
      project={{ id: project.id, name: project.name, orgId: project.orgId }}
      org={{ name: project.org.name }}
      folders={folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        path: f.path,
      }))}
      activeFolderId={activeFolderIdResolved}
      activeFolder={
        activeFolder
          ? {
              id: activeFolder.id,
              name: activeFolder.name,
              parentId: activeFolder.parentId,
            }
          : null
      }
      initialDocuments={documents.map((d) => ({
        id: d.id,
        originalName: d.originalName,
        isoName: d.isoName,
        status: d.status as string,
        revision: d.revision,
        mimeType: d.mimeType,
        fileSizeBytes: d.fileSizeBytes,
        createdAt: d.createdAt.toISOString(),
        uploader: {
          name: d.uploader.name,
          email: d.uploader.email,
        },
      }))}
    />
  );
}
