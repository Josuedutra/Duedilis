/**
 * DocumentLink — typed links between documents and entities.
 * Task: gov-1775322207963-6bjant (D4-07v2)
 *
 * Link types: REFERENCE, ATTACHMENT, EVIDENCE, SUPERSEDES, RESPONDS_TO
 * SUPERSEDES side-effect: marks target document status as SUPERSEDED
 * EvidenceLink existing model remains untouched (backward compatibility)
 */

export {
  createDocumentLink,
  listLinksFrom,
  listLinksTo,
  getDocumentEvidenceLinks,
} from "@/lib/actions/document-link-actions";

export type {
  CreateDocumentLinkInput,
  ListLinksInput,
  GetEvidenceLinksInput,
} from "@/lib/actions/document-link-actions";

/**
 * listDocumentLinks — bidirectional: returns both FROM and TO links for a doc
 */
import {
  listLinksFrom,
  listLinksTo,
} from "@/lib/actions/document-link-actions";

export async function listDocumentLinks({
  orgId,
  docId,
}: {
  orgId: string;
  docId: string;
}) {
  const [from, to] = await Promise.all([
    listLinksFrom({ orgId, sourceId: docId }),
    listLinksTo({ orgId, targetId: docId }),
  ]);

  // Deduplicate by id (in case a link has same source and target)
  const seen = new Set<string>();
  const all = [];
  for (const link of [...from, ...to]) {
    if (!seen.has(link.id)) {
      seen.add(link.id);
      all.push(link);
    }
  }
  return all;
}
