"use client";

/**
 * IssueEvidenceLinks — secção de links probatórios na página de detalhe de issue.
 * Cliente: gerencia estado do dialog de criação.
 * Sprint D3, Task D3-04/05 (gov-1775077692551-w466q6)
 */

import { useState, useCallback } from "react";
import { LinkList } from "@/components/evidence-links/link-list";
import { CreateLinkDialog } from "@/components/evidence-links/create-link-dialog";

interface IssueEvidenceLinksProps {
  orgId: string;
  projectId: string;
  issueId: string;
}

export function IssueEvidenceLinks({
  orgId,
  projectId,
  issueId,
}: IssueEvidenceLinksProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">
          Links Probatórios
        </h2>
        <button
          onClick={() => setDialogOpen(true)}
          className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg font-medium"
        >
          Ligar entidade
        </button>
      </div>

      <LinkList
        key={refreshKey}
        orgId={orgId}
        entityType="Issue"
        entityId={issueId}
        onCreateLink={() => setDialogOpen(true)}
      />

      <CreateLinkDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
        orgId={orgId}
        projectId={projectId}
        sourceType="Issue"
        sourceId={issueId}
      />
    </>
  );
}
