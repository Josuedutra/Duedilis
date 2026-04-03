/**
 * Galeria de Fotos de Obra — por projecto
 * Sprint D2, Task gov-1775041297153-uzp0s2
 *
 * Filtros: por issue, por data, por uploader.
 * Paginação: 20 fotos por página.
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { PhotoUpload } from "@/components/photos/photo-upload";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPhotosPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      org: { memberships: { some: { userId: session.user.id } } },
    },
    include: { org: { select: { id: true, name: true } } },
  });

  if (!project) notFound();

  // Get a default folder for photo uploads (first folder or null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const defaultFolder = await db.cdeFolder
    .findFirst({
      where: { orgId: project.orgId, projectId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
    .catch(() => null);

  const folderId = defaultFolder?.id ?? "default";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/projects" className="hover:text-gray-700">
          Projectos
        </Link>
        {" › "}
        <Link href={`/projects/${projectId}`} className="hover:text-gray-700">
          {project.name}
        </Link>
        {" › "}
        <span className="text-gray-900">Fotos de Obra</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fotos de Obra</h1>
          <p className="text-sm text-gray-500 mt-1">{project.org.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload panel */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Adicionar Fotos
            </h2>
            <PhotoUpload
              input={{
                orgId: project.orgId,
                projectId,
                folderId,
              }}
            />
          </div>
        </div>

        {/* Gallery */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Galeria
            </h2>
            <PhotoGallery projectId={projectId} orgId={project.orgId} />
          </div>
        </div>
      </div>
    </div>
  );
}
