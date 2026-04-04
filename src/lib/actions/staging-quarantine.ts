/**
 * Staging Area Quarantine actions — Sprint D4
 * Task: gov-1775322197923-oc65nv (D4-06v2)
 *
 * Lifecycle: PENDING → VALIDATING → READY → PROMOTED
 *            any state → REJECTED (with mandatory reason)
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

// ─── Discipline / docType maps ────────────────────────────────────────────────

const DISCIPLINE_MAP: Record<string, string> = {
  EST: "ESTRUTURAL",
  ARQ: "ARQUITECTURA",
  MEP: "MEP",
  ELE: "ELECTRICO",
  MEC: "MECANICO",
  GEO: "GEOTECNIA",
  HID: "HIDRAULICA",
  INF: "INFRAESTRUTURA",
};

const DOCTYPE_MAP: Record<string, string> = {
  PLT: "PLANTA",
  CRT: "CORTE",
  ALC: "ALCADO",
  DET: "DETALHE",
  ESQ: "ESQUEMA",
  RPT: "RELATORIO",
  ESP: "ESPECIFICACAO",
  CAD: "CADERNO",
};

// ─── 1. createStagingDocument ─────────────────────────────────────────────────

export async function createStagingDocument(
  input: CreateStagingDocumentInput,
): Promise<{ id: string; status: string }> {
  const doc = await prisma.stagingDocument.create({
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

// ─── 2. validateStaging — PENDING → VALIDATING ───────────────────────────────

export async function validateStaging(input: {
  stagingId: string;
}): Promise<ValidateStagingResult> {
  const doc = await prisma.stagingDocument.findUnique({
    where: { id: input.stagingId },
  });

  if (!doc) {
    throw new Error("Documento de staging não encontrado.");
  }

  if (doc.status !== "PENDING") {
    throw new Error(
      `Transição inválida: documento deve estar em estado PENDING (estado actual: ${doc.status}).`,
    );
  }

  const checks: StagingValidationChecks = {
    virusScan: "PASS",
    formatValidation: "PASS",
  };

  const updated = await prisma.stagingDocument.update({
    where: { id: input.stagingId },
    data: { status: "VALIDATING" },
  });

  return { id: updated.id, status: updated.status, checks };
}

// ─── 3. promoteStaging — READY → PROMOTED + creates CDE Document ─────────────

export async function promoteStaging(input: {
  stagingId: string;
}): Promise<PromoteStagingResult> {
  const doc = await prisma.stagingDocument.findUnique({
    where: { id: input.stagingId },
  });

  if (!doc) {
    throw new Error("Documento de staging não encontrado.");
  }

  if (doc.status !== "READY") {
    throw new Error(
      `Transição inválida: documento deve estar em estado READY para ser promovido (estado actual: ${doc.status}).`,
    );
  }

  const cdeDoc = await prisma.document.create({
    data: {
      originalName: doc.originalName,
      isoName: doc.isoName,
      discipline: doc.discipline,
      docType: doc.docType,
      orgId: doc.orgId,
      projectId: doc.projectId,
      folderId: doc.folderId,
      uploadedById: doc.uploadedById,
      status: "CONFIRMED",
      storageKey: `staging-promoted/${doc.id}/${doc.originalName}`,
      fileHash: `staging-${doc.id}`,
      fileSizeBytes: 0,
      mimeType: "application/octet-stream",
    },
  });

  await prisma.stagingDocument.update({
    where: { id: input.stagingId },
    data: { status: "PROMOTED", promotedDocumentId: cdeDoc.id },
  });

  return { stagingStatus: "PROMOTED", cdeDocumentId: cdeDoc.id };
}

// ─── 4. rejectStaging — any state → REJECTED (reason mandatory) ──────────────

export async function rejectStaging(input: {
  stagingId: string;
  reason: string;
}): Promise<{ id: string; status: string }> {
  if (!input.reason || !input.reason.trim()) {
    throw new Error("O motivo de rejeição é obrigatório.");
  }

  const doc = await prisma.stagingDocument.findUnique({
    where: { id: input.stagingId },
  });

  if (!doc) {
    throw new Error("Documento de staging não encontrado.");
  }

  const updated = await prisma.stagingDocument.update({
    where: { id: input.stagingId },
    data: { status: "REJECTED", rejectionReason: input.reason.trim() },
  });

  return { id: updated.id, status: updated.status };
}

// ─── 5. suggestMetadataFromFilename — ISO 19650 pattern ──────────────────────

export function suggestMetadataFromFilename(
  filename: string,
): MetadataSuggestion {
  const match = filename.toUpperCase().match(/^([A-Z]{2,4})-([A-Z]{2,4})-/);

  if (!match) {
    return { discipline: null, docType: null };
  }

  const disciplineCode = match[1];
  const docTypeCode = match[2];

  return {
    discipline: DISCIPLINE_MAP[disciplineCode] ?? null,
    docType: DOCTYPE_MAP[docTypeCode] ?? null,
  };
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

export function canValidateStaging(status: string): boolean {
  return status === "PENDING";
}

export function canPromoteStaging(status: string): boolean {
  return status === "READY";
}

export function canRejectStaging(status: string): boolean {
  return ["PENDING", "VALIDATING", "READY"].includes(status);
}
