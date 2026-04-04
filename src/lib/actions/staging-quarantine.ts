/**
 * Staging Area Quarantine actions — Sprint D4
 * Task: gov-1775321986183-21c8k1 (D4-E3-06v2)
 *
 * TDD stub — functions are not implemented yet.
 * Tests in src/__tests__/cde/staging-quarantine.test.ts define the expected behaviour.
 *
 * Lifecycle: PENDING → VALIDATING → READY → PROMOTED
 */

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
  _input: CreateStagingDocumentInput,
): Promise<{ id: string; status: string }> {
  throw new Error("Not implemented");
}

export async function validateStaging(_input: {
  stagingId: string;
}): Promise<ValidateStagingResult> {
  throw new Error("Not implemented");
}

export async function promoteStaging(_input: {
  stagingId: string;
}): Promise<PromoteStagingResult> {
  throw new Error("Not implemented");
}

export async function rejectStaging(_input: {
  stagingId: string;
  reason: string;
}): Promise<{ id: string; status: string }> {
  throw new Error("Not implemented");
}

export function suggestMetadataFromFilename(
  _filename: string,
): MetadataSuggestion {
  throw new Error("Not implemented");
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
