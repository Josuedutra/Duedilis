/**
 * CDE Staging module — re-exports from staging-quarantine actions
 * Task: gov-1775322197923-oc65nv (D4-06v2)
 */

export {
  createStagingDocument,
  validateStaging,
  promoteStaging,
  rejectStaging,
  // suggestMetadataFromFilename moved to status-badges.ts
} from "@/lib/actions/staging-quarantine";

export type {
  CreateStagingDocumentInput,
  ValidateStagingResult,
  PromoteStagingResult,
  MetadataSuggestion,
  StagingValidationChecks,
} from "@/lib/actions/staging-quarantine";
