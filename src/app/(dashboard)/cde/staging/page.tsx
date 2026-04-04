/**
 * Staging Area page — CDE quarantine queue
 * Task: gov-1775322240095-6ic9an (D4-11v2)
 *
 * Lists StagingDocuments with validate/promote/reject actions.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StagingList } from "@/components/cde/StagingList";

interface StagingPageProps {
  searchParams: Promise<{ orgId?: string; projectId?: string }>;
}

export default async function StagingPage({ searchParams }: StagingPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const { orgId, projectId } = params;

  if (!orgId || !projectId) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Staging Area</h1>
        <p className="text-sm text-gray-500">
          Parâmetros orgId e projectId são obrigatórios.
        </p>
      </main>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stagingDocs = await (prisma as any).stagingDocument.findMany({
    where: { orgId, projectId },
    orderBy: { uploadedAt: "desc" },
  });

  const documents = stagingDocs.map(
    (d: {
      id: string;
      originalName: string;
      isoName: string | null;
      status: string;
      uploadedAt: Date;
      rejectionReason?: string | null;
    }) => ({
      id: d.id,
      originalName: d.originalName,
      isoName: d.isoName,
      status: d.status,
      uploadedAt: d.uploadedAt.toISOString(),
      rejectionReason: d.rejectionReason ?? null,
    }),
  );

  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Staging Area</h1>
        <p className="text-sm text-gray-500 mt-1">
          Documentos em quarentena aguardando validação.
        </p>
      </div>

      <StagingList documents={documents} />
    </main>
  );
}
