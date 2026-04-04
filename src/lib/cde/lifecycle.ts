/**
 * CDE Document Lifecycle — state machine
 * ISO 19650: WIP → SHARED → PUBLISHED → SUPERSEDED → ARCHIVED
 *
 * Task: gov-1775322165820-2ufgff (D4-02v2)
 */

export {
  transitionCdeDocLifecycle,
  CDE_VALID_TRANSITIONS,
} from "@/lib/actions/cde-actions";
