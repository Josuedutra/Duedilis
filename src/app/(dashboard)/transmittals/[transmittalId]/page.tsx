import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TransmittalStatusBadge } from "@/components/transmittals/TransmittalStatusBadge";

/**
 * Transmittal detail page — /transmittals/[transmittalId]
 * Task: gov-1775351727595-0iu0dd (D4-12v2)
 *
 * Shows transmittal details + recipients list with receipt status.
 * Full data fetching wired in next sprint when org/project context is established.
 */

interface Props {
  params: Promise<{ transmittalId: string }>;
}

export default async function TransmittalDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { transmittalId } = await params;

  return (
    <main className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Transmittal #{transmittalId.slice(0, 8)}
          </h1>
          <TransmittalStatusBadge status="DRAFT" />
        </div>
      </div>

      {/* Recipients */}
      <section className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Destinatários</h2>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="px-6 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Carlos Ferreira
              </p>
              <p className="text-xs text-gray-500">cliente@construtora.pt</p>
            </div>
            <span className="text-xs text-gray-400">Aguarda recepção</span>
          </div>
        </div>
      </section>

      {/* Documents */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Documentos</h2>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-500">Sem documentos associados.</p>
        </div>
      </section>
    </main>
  );
}
