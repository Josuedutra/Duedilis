"use client";

/**
 * DocumentDetailClient — client wrapper for document detail page
 * Task: gov-1775322234055-de2m1o (D4-10v2)
 *
 * Manages modal open/close state and status optimistic update.
 */

import { useState } from "react";
import { LifecycleBadge } from "@/components/cde/LifecycleBadge";
import { TransitionModal } from "@/components/cde/TransitionModal";
import { RevisionTimeline } from "@/components/cde/RevisionTimeline";
import { StampTimeline } from "@/components/cde/StampTimeline";
import type {
  DocumentRevision,
  ValidationStampWithType,
} from "@/lib/actions/cde-revisions";

interface DocumentDetailClientProps {
  document: { id: string; cdeStatus: string; [key: string]: unknown };
  revisions: DocumentRevision[];
  stamps: ValidationStampWithType[];
}

export function DocumentDetailClient({
  document,
  revisions,
  stamps,
}: DocumentDetailClientProps) {
  const [currentStatus, setCurrentStatus] = useState(document.cdeStatus);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-8">
      {/* Lifecycle badge */}
      <section>
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
          Estado do lifecycle
        </h2>
        <LifecycleBadge
          status={currentStatus}
          onClick={() => setModalOpen(true)}
        />
        <p className="text-xs text-gray-400 mt-1">
          Clique no badge para transitar o estado do documento.
        </p>
      </section>

      {/* Revision timeline */}
      <section>
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
          Histórico de revisões
        </h2>
        <RevisionTimeline revisions={revisions} />
      </section>

      {/* Stamp timeline */}
      <section>
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
          Stamps de validação
        </h2>
        <StampTimeline stamps={stamps} />
      </section>

      {/* Transition modal */}
      <TransitionModal
        documentId={document.id}
        currentStatus={currentStatus}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={(newStatus) => setCurrentStatus(newStatus)}
      />
    </div>
  );
}
