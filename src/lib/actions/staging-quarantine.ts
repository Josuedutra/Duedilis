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
