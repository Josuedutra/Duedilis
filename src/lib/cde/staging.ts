/**
 * CDE Staging Area — quarantine lifecycle
 * PENDING → VALIDATING → READY → PROMOTED
 *
 * Task: gov-1775322197923-oc65nv (D4-06v2)
 *
 * Re-exports from lib/actions/staging-quarantine for CDE module consumers.
 */

export {
  createStagingDocument,
  validateStaging,
  promoteStaging,
  rejectStaging,
  suggestMetadataFromFilename,
  getStagingStatusBadgeConfig,
  canValidateStaging,
  canPromoteStaging,
  canRejectStaging,
} from "@/lib/actions/staging-quarantine";

export type {
  CreateStagingDocumentInput,
  ValidateStagingResult,
  PromoteStagingResult,
  MetadataSuggestion,
  StagingStatusBadgeConfig,
  StagingValidationChecks,
} from "@/lib/actions/staging-quarantine";
