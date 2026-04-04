/**
 * Document Detail Page — CDE
 * Task: gov-1775322234055-de2m1o (D4-10v2)
 *
 * Shows: lifecycle badge (clickable → transition modal),
 *        revision timeline, stamp timeline.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDocumentDetailData } from "@/lib/actions/cde-actions";
import {
  getRevisionHistory,
  getValidationStamps,
} from "@/lib/actions/cde-revisions";
import { DocumentDetailClient } from "./DocumentDetailClient";

interface PageProps {
  params: Promise<{ docId: string }>;
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { docId } = await params;

  const [{ document }, revisions, stamps] = await Promise.all([
    getDocumentDetailData({ documentId: docId }),
    getRevisionHistory({ documentId: docId }),
    getValidationStamps({ documentId: docId }),
  ]);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {(document.originalName as string) ?? "Documento"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Revisão actual: {(document.currentRevisionCode as string) ?? "—"}
        </p>
      </div>

      <DocumentDetailClient
        document={document}
        revisions={revisions}
        stamps={stamps}
      />
    </main>
  );
}
