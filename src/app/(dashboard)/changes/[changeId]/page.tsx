import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ChangeStatusBadge } from "@/components/changes/ChangeStatusBadge";

/**
 * Change detail page — /changes/[changeId]
 * Task: gov-1775351727595-0iu0dd (D4-12v2)
 *
 * Shows change details + immutable comment timeline.
 * Full data fetching wired in next sprint when org/project context is established.
 */

interface Props {
  params: Promise<{ changeId: string }>;
}

export default async function ChangeDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { changeId } = await params;

  return (
    <main className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Change #{changeId.slice(0, 8)}
          </h1>
          <ChangeStatusBadge status="OPEN" />
        </div>
        <p className="text-sm text-gray-500">ALTERATION</p>
      </div>

      {/* Comment timeline */}
      <section className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Timeline de Comentários
          </h2>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-500">Sem comentários ainda.</p>
        </div>
      </section>

      {/* Linked documents */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Documentos Associados
          </h2>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-500">Sem documentos associados.</p>
        </div>
      </section>
    </main>
  );
}
