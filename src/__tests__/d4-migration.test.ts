// D4-E3-01: Migration dry-run baseline tests
// Task: gov-1775310192719-yogb5j
// Validates the current Prisma schema BEFORE adding D4 models.
// NÃO modifica schema.prisma — apenas valida o estado actual.

import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

const SCHEMA_PATH = path.resolve(process.cwd(), "prisma/schema.prisma");

function readSchema(): string {
  return readFileSync(SCHEMA_PATH, "utf-8");
}

describe("D4-E3-01: Migration dry-run — baseline schema validation", () => {
  // Teste 1: prisma validate retorna exit code 0
  it("prisma validate exits with code 0 on current schema", () => {
    let exitCode = 0;
    try {
      execSync("npx prisma validate", {
        cwd: process.cwd(),
        stdio: "pipe",
      });
    } catch (err: unknown) {
      exitCode = (err as { status?: number }).status ?? 1;
    }
    expect(exitCode).toBe(0);
  });

  // Teste 2: Schema parse sem erros — todos os modelos existentes reconhecidos
  it("schema contains all expected existing models", () => {
    const schema = readSchema();

    const expectedModels = [
      "Account",
      "Session",
      "VerificationToken",
      "User",
      "Organization",
      "OrgMembership",
      "Project",
      "ProjectMembership",
      "Issue",
      "IssueComment",
      "IssueStamp",
      "IssueClosure",
      "Evidence",
      "EvidenceLink",
      "CdeFolder",
      "FolderAcl",
      "Document",
      "UploadBatch",
      "AuditLog",
      "Approval",
      "Photo",
      "Meeting",
      "MeetingParticipant",
      "MeetingMinutes",
      "ActionItem",
      "Notification",
      "NotificationOutbox",
    ];

    for (const model of expectedModels) {
      expect(schema).toMatch(new RegExp(`model ${model}\\s*\\{`));
    }
  });

  // Teste 3: Enum DocumentStatus existe e contém valores esperados
  it("enum DocumentStatus exists with expected values", () => {
    const schema = readSchema();

    // Enum block exists
    expect(schema).toMatch(/enum DocumentStatus\s*\{/);

    const enumMatch = schema.match(/enum DocumentStatus\s*\{([^}]+)\}/);
    expect(enumMatch).not.toBeNull();

    const enumBody = enumMatch![1];
    const expectedValues = [
      "PENDING",
      "NORMALIZING",
      "READY",
      "CONFIRMED",
      "REJECTED",
    ];

    for (const value of expectedValues) {
      expect(enumBody).toContain(value);
    }
  });

  // Teste 4: model Document tem campos obrigatórios actuais
  it("model Document has required fields: id, originalName, projectId", () => {
    const schema = readSchema();

    // Extract Document model block by tracking brace depth (handles } in comments)
    const startIdx = schema.indexOf("model Document {");
    expect(startIdx).toBeGreaterThan(-1);

    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx; i < schema.length; i++) {
      if (schema[i] === "{") depth++;
      else if (schema[i] === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    expect(endIdx).toBeGreaterThan(startIdx);

    const docBody = schema.slice(startIdx, endIdx + 1);

    // Core fields present in current schema
    expect(docBody).toContain("id ");
    expect(docBody).toContain("originalName");
    expect(docBody).toContain("projectId");
    expect(docBody).toContain("DocumentStatus");
  });
});
