// DocumentLink actions — D4-07 implementation stub
// Tests (D4-E3-07) are written against this interface.
// Implementation is in D4-07.

export interface CreateDocumentLinkInput {
  orgId: string;
  projectId: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  linkType: string;
  isEvidence?: boolean;
}

export interface ListLinksInput {
  orgId: string;
  sourceId?: string;
  targetId?: string;
}

export interface GetEvidenceLinksInput {
  orgId: string;
  docId: string;
}

export async function createDocumentLink(
  _input: CreateDocumentLinkInput,
): Promise<never> {
  throw new Error("Not implemented — D4-07");
}

export async function listLinksFrom(_input: ListLinksInput): Promise<never[]> {
  throw new Error("Not implemented — D4-07");
}

export async function listLinksTo(_input: ListLinksInput): Promise<never[]> {
  throw new Error("Not implemented — D4-07");
}

export async function getDocumentEvidenceLinks(
  _input: GetEvidenceLinksInput,
): Promise<never[]> {
  throw new Error("Not implemented — D4-07");
}
