"use client";

/**
 * MeetingEvidenceLinks — secção de links probatórios na página de detalhe de reunião.
 * Sprint D3, Task D3-04/05 (gov-1775077692551-w466q6)
 */

import { useState, useCallback } from "react";
import { LinkList } from "@/components/evidence-links/link-list";
import { CreateLinkDialog } from "@/components/evidence-links/create-link-dialog";

interface MeetingEvidenceLinksProps {
  orgId: string;
  projectId: string;
  meetingId: string;
}

export function MeetingEvidenceLinks({
  orgId,
  projectId,
  meetingId,
}: MeetingEvidenceLinksProps) {
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
        entityType="Meeting"
        entityId={meetingId}
        onCreateLink={() => setDialogOpen(true)}
      />

      <CreateLinkDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
        orgId={orgId}
        projectId={projectId}
        sourceType="Meeting"
        sourceId={meetingId}
      />
    </>
  );
}
