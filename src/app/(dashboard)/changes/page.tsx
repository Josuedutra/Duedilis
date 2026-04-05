import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ChangeStatusBadge } from "@/components/changes/ChangeStatusBadge";

/**
 * Changes list page — /changes
 * Task: gov-1775351727595-0iu0dd (D4-12v2)
 *
 * Server component — requires auth. Lists ChangeRecords with type and status badges.
 * org/project IDs come from session context (stub: shown as search params in future sprint).
 */

export default async function ChangesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Changes</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm text-gray-500">
            Lista de Changes &amp; Claims do projecto
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {/* Placeholder row demonstrating ChangeStatusBadge rendering */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Alteração de projecto
              </p>
              <p className="text-xs text-gray-500 mt-0.5">ALTERATION</p>
            </div>
            <ChangeStatusBadge status="DRAFT" />
          </div>

          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Reclamação de prazo
              </p>
              <p className="text-xs text-gray-500 mt-0.5">CLAIM</p>
            </div>
            <ChangeStatusBadge status="OPEN" />
          </div>

          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Revisão de escopo
              </p>
              <p className="text-xs text-gray-500 mt-0.5">ALTERATION</p>
            </div>
            <ChangeStatusBadge status="APPROVED" />
          </div>
        </div>
      </div>
    </main>
  );
}
