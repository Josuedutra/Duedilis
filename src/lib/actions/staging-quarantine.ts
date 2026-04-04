/**
 * Staging Area Quarantine actions — Sprint D4
 * Task: gov-1775322240095-6ic9an (D4-11v2)
 *
 * Lifecycle: PENDING → VALIDATING → READY → PROMOTED
 */

import { prisma } from "@/lib/prisma";

export interface StagingValidationChecks {
  virusScan: "PASS" | "FAIL" | "PENDING";
  formatValidation: "PASS" | "FAIL" | "PENDING";
}

export interface CreateStagingDocumentInput {
  originalName: string;
  orgId: string;
  projectId: string;
  folderId: string;
  uploadedById: string;
}

export interface ValidateStagingResult {
  id: string;
  status: string;
  checks: StagingValidationChecks;
}

export interface PromoteStagingResult {
  stagingStatus: string;
  cdeDocumentId: string;
}

export interface MetadataSuggestion {
  discipline: string | null;
  docType: string | null;
}

export async function createStagingDocument(
  input: CreateStagingDocumentInput,
): Promise<{ id: string; status: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await (prisma as any).stagingDocument.create({
    data: {
      originalName: input.originalName,
      orgId: input.orgId,
      projectId: input.projectId,
      folderId: input.folderId,
      uploadedById: input.uploadedById,
      status: "PENDING",
    },
  });
  return { id: doc.id, status: doc.status };
}

export async function validateStaging(input: {
  stagingId: string;
}): Promise<ValidateStagingResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await (prisma as any).stagingDocument.findUnique({
    where: { id: input.stagingId },
  });
  if (!doc) throw new Error("Staging document não encontrado.");
  if (doc.status !== "PENDING") {
    throw new Error(
      `Só documentos PENDING podem ser validados. Status actual: ${doc.status}`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma as any).stagingDocument.update({
    where: { id: input.stagingId },
    data: { status: "VALIDATING" },
  });

  return {
    id: updated.id,
    status: updated.status,
    checks: {
      virusScan: "PENDING",
      formatValidation: "PENDING",
    },
  };
}

export async function promoteStaging(input: {
  stagingId: string;
}): Promise<PromoteStagingResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await (prisma as any).stagingDocument.findUnique({
    where: { id: input.stagingId },
  });
  if (!doc) throw new Error("Staging document não encontrado.");
  if (doc.status !== "READY") {
    throw new Error(
      `Só documentos READY podem ser promovidos. Status actual: ${doc.status}`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).stagingDocument.update({
    where: { id: input.stagingId },
    data: { status: "PROMOTED" },
  });

  const cdeDoc = await prisma.document.create({
    data: {
      originalName: doc.originalName,
      isoName: doc.isoName ?? null,
      orgId: doc.orgId,
      projectId: doc.projectId,
      folderId: doc.folderId,
      uploadedById: doc.uploadedById,
      status: "CONFIRMED",
    },
  });

  return {
    stagingStatus: "PROMOTED",
    cdeDocumentId: cdeDoc.id,
  };
}

export async function rejectStaging(input: {
  stagingId: string;
  reason: string;
}): Promise<{ id: string; status: string }> {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("Motivo de rejeição obrigatório.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await (prisma as any).stagingDocument.findUnique({
    where: { id: input.stagingId },
  });
  if (!doc) throw new Error("Staging document não encontrado.");
  if (!["PENDING", "VALIDATING", "READY"].includes(doc.status)) {
    throw new Error(
      `Documentos em estado ${doc.status} não podem ser rejeitados.`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma as any).stagingDocument.update({
    where: { id: input.stagingId },
    data: {
      status: "REJECTED",
      rejectionReason: input.reason,
    },
  });

  return { id: updated.id, status: updated.status };
}

export function suggestMetadataFromFilename(
  filename: string,
): MetadataSuggestion {
  const upper = filename.toUpperCase();
  const parts = upper.split("-");
  if (parts.length < 2) return { discipline: null, docType: null };

  const DISCIPLINE_MAP: Record<string, string> = {
    ARQ: "ARQUITECTURA",
    EST: "ESTRUTURAL",
    MEP: "MEP",
  };

  const DOC_TYPE_MAP: Record<string, string> = {
    PLT: "PLANTA",
    ESQ: "ESQUEMA",
    CRT: "CORTE",
  };

  const discipline = DISCIPLINE_MAP[parts[0]] ?? null;
  const docType = DOC_TYPE_MAP[parts[1]] ?? null;

  if (!discipline && !docType) return { discipline: null, docType: null };

  return { discipline, docType };
}

// ─── Frontend helpers — badge config and button visibility guards ─────────────

export interface StagingStatusBadgeConfig {
  variant: "warning" | "default" | "success" | "error";
  label: string;
}

const STAGING_STATUS_BADGE_MAP: Record<string, StagingStatusBadgeConfig> = {
  PENDING: { variant: "warning", label: "Pendente" },
  VALIDATING: { variant: "default", label: "A validar" },
  READY: { variant: "success", label: "Pronto" },
  PROMOTED: { variant: "success", label: "Promovido" },
  REJECTED: { variant: "error", label: "Rejeitado" },
};

export function getStagingStatusBadgeConfig(
  status: string,
): StagingStatusBadgeConfig {
  return (
    STAGING_STATUS_BADGE_MAP[status] ?? { variant: "default", label: status }
  );
}

/** Validate button visible only for PENDING documents */
export function canValidateStaging(status: string): boolean {
  return status === "PENDING";
}

/** Promote button visible only for READY documents */
export function canPromoteStaging(status: string): boolean {
  return status === "READY";
}

/** Reject button visible for PENDING, VALIDATING, and READY documents */
export function canRejectStaging(status: string): boolean {
  return ["PENDING", "VALIDATING", "READY"].includes(status);
}
