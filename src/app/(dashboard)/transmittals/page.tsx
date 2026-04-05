import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TransmittalStatusBadge } from "@/components/transmittals/TransmittalStatusBadge";

/**
 * Transmittals list page — /transmittals
 * Task: gov-1775351727595-0iu0dd (D4-12v2)
 *
 * Server component — requires auth. Lists Transmittals with status badges and recipient counts.
 */

export default async function TransmittalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transmittals</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm text-gray-500">
            Lista de Transmittals do projecto
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {/* Placeholder rows demonstrating TransmittalStatusBadge + recipients */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Transmittal ARQ-REV-001
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                2 documentos · 1 destinatário
              </p>
            </div>
            <TransmittalStatusBadge status="DRAFT" />
          </div>

          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Transmittal EST-REV-001
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                3 documentos · 2 destinatários
              </p>
            </div>
            <TransmittalStatusBadge status="SENT" />
          </div>

          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Transmittal MEP-001
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                1 documento · 1 destinatário
              </p>
            </div>
            <TransmittalStatusBadge status="ACKNOWLEDGED" />
          </div>
        </div>
      </div>
    </main>
  );
}
