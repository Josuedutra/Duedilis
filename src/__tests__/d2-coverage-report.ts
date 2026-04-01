/**
 * D2 Coverage Report — Sprint D2
 * Task: gov-1775041332299-9t7dya
 *
 * Verifica cobertura mínima de testes para os modelos D2:
 *   Document  : ≥ 5 testes
 *   Approval  : ≥ 5 testes
 *   Photo     : ≥ 5 testes
 *   CdeFolder : ≥ 3 testes
 *   AuditLog  : ≥ 3 testes
 *   RLS       : ≥ 4 testes
 *
 * Como executar:
 *   npx tsx src/__tests__/d2-coverage-report.ts
 *
 * Retorna exit code 1 se algum módulo estiver abaixo do mínimo.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface ModuleCoverage {
  module: string;
  required: number;
  found: number;
  pass: boolean;
  testFiles: string[];
}

const TEST_DIR = path.join(__dirname);

/**
 * Conta os blocos `it(` / `test(` num ficheiro de teste.
 * Simples — não usa AST; funcional para os nossos casos.
 */
function countTests(filePath: string): number {
  const content = fs.readFileSync(filePath, "utf-8");
  // Match it( / test( / it.each( / test.each(
  const matches = content.match(
    /\bit\s*\(|\btest\s*\(|\bit\.each\s*\(|\btest\.each\s*\(/g,
  );
  return matches?.length ?? 0;
}

/**
 * Encontra os ficheiros de teste relevantes para um dado módulo.
 * Usa nomes de ficheiro + palavras-chave no conteúdo para mapeamento.
 */
function findTestsForModule(moduleKeywords: string[]): {
  files: string[];
  total: number;
} {
  const testFiles = fs
    .readdirSync(TEST_DIR)
    .filter((f) => f.endsWith(".test.ts"))
    .map((f) => path.join(TEST_DIR, f));

  const matching: string[] = [];
  let total = 0;

  for (const file of testFiles) {
    const content = fs.readFileSync(file, "utf-8").toLowerCase();
    const fileName = path.basename(file).toLowerCase();

    const relevant = moduleKeywords.some(
      (kw) =>
        content.includes(kw.toLowerCase()) ||
        fileName.includes(kw.toLowerCase()),
    );

    if (relevant) {
      const count = countTests(file);
      matching.push(`  ${path.basename(file)} (${count} tests)`);
      total += count;
    }
  }

  return { files: matching, total };
}

const modules: Array<{ name: string; keywords: string[]; required: number }> = [
  {
    name: "Document",
    keywords: [
      "document",
      "upload",
      "cde-actions",
      "upload-pipeline",
      "cde-crud",
      "approval-photo-schema",
      "d2-smoke",
    ],
    required: 5,
  },
  {
    name: "Approval",
    keywords: [
      "approval",
      "approvals",
      "approve",
      "approval-actions",
      "d2-smoke",
    ],
    required: 5,
  },
  {
    name: "Photo",
    keywords: ["photo", "foto", "photos", "photo-actions", "d2-smoke"],
    required: 5,
  },
  {
    name: "CdeFolder",
    keywords: [
      "cdefolder",
      "cde-folder",
      "cde-crud",
      "cde-actions",
      "d2-smoke",
    ],
    required: 3,
  },
  {
    name: "AuditLog",
    keywords: [
      "auditlog",
      "audit-log",
      "audit_log",
      "hash chain",
      "audit",
      "d2-smoke",
    ],
    required: 3,
  },
  {
    name: "RLS",
    keywords: ["rls", "org b", "isolation", "tenant", "rls-cde", "d2-smoke"],
    required: 4,
  },
];

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  Duedilis D2 — Coverage Report");
console.log("═══════════════════════════════════════════════════════════\n");

const results: ModuleCoverage[] = [];

for (const mod of modules) {
  const { files, total } = findTestsForModule(mod.keywords);
  const pass = total >= mod.required;

  results.push({
    module: mod.name,
    required: mod.required,
    found: total,
    pass,
    testFiles: files,
  });

  const status = pass ? "✅ PASS" : "❌ FAIL";
  console.log(`${status}  ${mod.name}`);
  console.log(`       Found: ${total} | Required: ≥${mod.required}`);
  if (files.length > 0) {
    files.forEach((f) => console.log(`       ${f}`));
  }
  console.log();
}

// ─── Resumo ───────────────────────────────────────────────────────────────────
const allPass = results.every((r) => r.pass);
const passing = results.filter((r) => r.pass).length;
const failing = results.filter((r) => !r.pass).length;

console.log("───────────────────────────────────────────────────────────");
console.log(`  Result: ${passing}/${results.length} modules pass`);

if (failing > 0) {
  console.log("\n  FAILING modules:");
  results
    .filter((r) => !r.pass)
    .forEach((r) => {
      console.log(`  ❌ ${r.module}: ${r.found} tests (need ${r.required})`);
    });
}

console.log("═══════════════════════════════════════════════════════════\n");

// ─── Verificação pnpm test (opcional — apenas em CI) ─────────────────────────
if (process.env.RUN_TESTS === "1") {
  console.log("Running pnpm test...\n");
  try {
    execSync("pnpm test", {
      stdio: "inherit",
      cwd: path.join(__dirname, "../../.."),
    });
    console.log("\n✅ pnpm test: all tests passed");
  } catch {
    console.error("\n❌ pnpm test: some tests failed");
    process.exit(1);
  }
}

if (!allPass) {
  process.exit(1);
}

console.log("✅ All D2 coverage thresholds met.\n");
