// D4-E3-01v2: Migration dry-run validation — 10 novos modelos + campos Document
// Task: gov-1775321950063-o7wx34
// Valida que o schema Prisma contém todos os modelos e campos do D4 sprint.
// Corre APÓS a migration D4 ser aplicada ao schema.prisma.

import { readFileSync } from "fs";
import path from "path";

const SCHEMA_PATH = path.resolve(process.cwd(), "prisma/schema.prisma");

function readSchema(): string {
  return readFileSync(SCHEMA_PATH, "utf-8");
}

/**
 * Extrai o bloco de um model ou enum do schema.
 * Suporta brace-depth tracking para modelos com comentários e nested types.
 */
function extractBlock(schema: string, keyword: string, name: string): string {
  const marker = `${keyword} ${name} {`;
  const startIdx = schema.indexOf(marker);
  if (startIdx === -1) return "";

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
  return endIdx > -1 ? schema.slice(startIdx, endIdx + 1) : "";
}

describe("D4-E3-01v2: Schema validation — D4 models e campos Document", () => {
  // ------------------------------------------------------------------ Teste 1
  it("schema contém os 10 novos modelos D4", () => {
    const schema = readSchema();

    const d4Models = [
      "DocumentRevision",
      "ValidationStamp",
      "StatusTransitionLog",
      "SlaRecord",
      "StagingDocument",
      "DocumentLink",
      "ChangeRecord",
      "ChangeComment",
      "Transmittal",
      "TransmittalDocument",
      "TransmittalRecipient",
    ];

    for (const model of d4Models) {
      expect(schema).toMatch(
        new RegExp(`model ${model}\\s*\\{`),
        `model ${model} não encontrado no schema`,
      );
    }
  });

  // ------------------------------------------------------------------ Teste 2
  it("model Document tem os novos campos D4: lifecycleStatus, contentHash, semanticKey, currentRevisionCode", () => {
    const schema = readSchema();
    const docBlock = extractBlock(schema, "model", "Document");

    expect(docBlock).not.toBe("", "model Document não encontrado no schema");

    const requiredFields = [
      "lifecycleStatus",
      "contentHash",
      "semanticKey",
      "currentRevisionCode",
    ];

    for (const field of requiredFields) {
      expect(docBlock).toContain(
        field,
        `campo ${field} não encontrado no model Document`,
      );
    }
  });

  // ------------------------------------------------------------------ Teste 3
  it("enum CdeDocStatus existe com todos os valores esperados", () => {
    const schema = readSchema();

    expect(schema).toMatch(
      /enum CdeDocStatus\s*\{/,
      "enum CdeDocStatus não encontrado no schema",
    );

    const enumBlock = extractBlock(schema, "enum", "CdeDocStatus");
    expect(enumBlock).not.toBe("", "bloco de enum CdeDocStatus vazio");

    const expectedValues = [
      "WIP",
      "SHARED",
      "PUBLISHED",
      "SUPERSEDED",
      "ARCHIVED",
    ];

    for (const value of expectedValues) {
      expect(enumBlock).toContain(
        value,
        `valor ${value} não encontrado em CdeDocStatus`,
      );
    }
  });

  // ------------------------------------------------------------------ Teste 4
  it("migration é não-destrutiva: Document mantém campos existentes (sem DROP/RENAME)", () => {
    const schema = readSchema();
    const docBlock = extractBlock(schema, "model", "Document");

    expect(docBlock).not.toBe("", "model Document não encontrado");

    // Campos que existiam antes do D4 — devem continuar presentes
    const preservedFields = [
      "id",
      "originalName",
      "projectId",
      "DocumentStatus",
    ];

    for (const field of preservedFields) {
      expect(docBlock).toContain(
        field,
        `campo existente '${field}' foi removido — migration destrutiva`,
      );
    }
  });

  // ------------------------------------------------------------------ Teste 5
  it("enum DocumentStatus original não foi renomeado nem removido", () => {
    const schema = readSchema();

    // enum DocumentStatus deve continuar a existir (não pode ter sido renomeado para CdeDocStatus)
    expect(schema).toMatch(
      /enum DocumentStatus\s*\{/,
      "enum DocumentStatus original foi removido ou renomeado — violação de constraint",
    );
  });
});
