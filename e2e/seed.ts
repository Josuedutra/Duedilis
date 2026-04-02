/**
 * E2E seed — creates test fixtures for Duedilis fiscal flow tests.
 *
 * Run via playwright globalSetup when DATABASE_URL is set.
 * Creates: org, project, 3 users (admin, fiscal, tecnico), CDE folder, sample issue.
 *
 * Idempotent: uses upsert/findFirst everywhere so re-runs don't fail.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter }) as any;

export interface E2EFixture {
  orgId: string;
  projectId: string;
  folderId: string;
  adminUserId: string;
  fiscalUserId: string;
  tecnicoUserId: string;
  issueId: string;
}

const FIXTURES = {
  org: {
    slug: "e2e-test-org",
    name: "Test Org E2E",
  },
  project: {
    slug: "e2e-test-project",
    name: "Test Project E2E",
  },
  users: {
    admin: {
      email: "e2e-admin@test.duedilis.pt",
      password: "E2eAdmin!2026",
      name: "Admin E2E",
    },
    fiscal: {
      email: "e2e-fiscal@test.duedilis.pt",
      password: "E2eFiscal!2026",
      name: "Fiscal E2E",
    },
    tecnico: {
      email: "e2e-tecnico@test.duedilis.pt",
      password: "E2eTecnico!2026",
      name: "Técnico E2E",
    },
  },
};

export async function seedE2EData(): Promise<E2EFixture> {
  console.log("[e2e/seed] Creating E2E test fixtures...");

  // Bail out if DB not available
  if (!process.env.DATABASE_URL) {
    console.warn("[e2e/seed] DATABASE_URL not set — skipping seed");
    process.env.E2E_DB_AVAILABLE = "false";
    return {
      orgId: "",
      projectId: "",
      folderId: "",
      adminUserId: "",
      fiscalUserId: "",
      tecnicoUserId: "",
      issueId: "",
    };
  }

  // Create organization (upsert by slug)
  const org = await prisma.organization.upsert({
    where: { slug: FIXTURES.org.slug },
    update: { name: FIXTURES.org.name },
    create: {
      slug: FIXTURES.org.slug,
      name: FIXTURES.org.name,
      description: "Organização de testes E2E — criada automaticamente",
    },
  });

  console.log(`[e2e/seed] Org: ${org.id}`);

  // Create users with hashed passwords
  const [adminUser, fiscalUser, tecnicoUser] = await Promise.all([
    createUser(FIXTURES.users.admin),
    createUser(FIXTURES.users.fiscal),
    createUser(FIXTURES.users.tecnico),
  ]);

  console.log(
    `[e2e/seed] Users: ${adminUser.id}, ${fiscalUser.id}, ${tecnicoUser.id}`,
  );

  // Create org memberships
  await Promise.all([
    prisma.orgMembership.upsert({
      where: { userId_orgId: { userId: adminUser.id, orgId: org.id } },
      update: {},
      create: { userId: adminUser.id, orgId: org.id, role: "ADMIN_ORG" },
    }),
    prisma.orgMembership.upsert({
      where: { userId_orgId: { userId: fiscalUser.id, orgId: org.id } },
      update: {},
      create: { userId: fiscalUser.id, orgId: org.id, role: "FISCAL" },
    }),
    prisma.orgMembership.upsert({
      where: { userId_orgId: { userId: tecnicoUser.id, orgId: org.id } },
      update: {},
      create: { userId: tecnicoUser.id, orgId: org.id, role: "TECNICO" },
    }),
  ]);

  // Create project (upsert by orgId+slug)
  const project = await prisma.project.upsert({
    where: { orgId_slug: { orgId: org.id, slug: FIXTURES.project.slug } },
    update: { name: FIXTURES.project.name },
    create: {
      orgId: org.id,
      slug: FIXTURES.project.slug,
      name: FIXTURES.project.name,
      description: "Projecto de teste E2E",
    },
  });

  console.log(`[e2e/seed] Project: ${project.id}`);

  // Add project memberships
  await Promise.all([
    prisma.projectMembership.upsert({
      where: {
        userId_projectId: { userId: adminUser.id, projectId: project.id },
      },
      update: {},
      create: {
        projectId: project.id,
        userId: adminUser.id,
        orgId: org.id,
        role: "GESTOR_PROJETO",
      },
    }),
    prisma.projectMembership.upsert({
      where: {
        userId_projectId: { userId: fiscalUser.id, projectId: project.id },
      },
      update: {},
      create: {
        projectId: project.id,
        userId: fiscalUser.id,
        orgId: org.id,
        role: "FISCAL",
      },
    }),
  ]);

  // Create CDE folder (findFirst + create pattern — no unique constraint on name)
  let folder = await prisma.cdeFolder.findFirst({
    where: { orgId: org.id, projectId: project.id, name: "CDE Test Folder" },
  });
  if (!folder) {
    folder = await prisma.cdeFolder.create({
      data: {
        orgId: org.id,
        projectId: project.id,
        name: "CDE Test Folder",
        description: "Pasta CDE de testes E2E",
        path: `/${org.id}/${project.id}/cde-test-folder`,
      },
    });
  }

  console.log(`[e2e/seed] CDE Folder: ${folder.id}`);

  // Create sample issue (upsert by deterministic ID)
  const issueId = `e2e-issue-${project.id.substring(0, 8)}`;
  let issue = await prisma.issue.findFirst({ where: { id: issueId } });
  if (!issue) {
    issue = await prisma.issue.create({
      data: {
        id: issueId,
        orgId: org.id,
        projectId: project.id,
        type: "NAO_CONFORMIDADE",
        title: "NC de Teste E2E — Pré-existente",
        description:
          "Não conformidade criada pelo seed E2E para testes de evidence links",
        status: "ABERTA",
        priority: "MEDIA",
        reportedById: adminUser.id,
      },
    });
  }

  console.log(`[e2e/seed] Issue: ${issue.id}`);

  // Export fixture IDs for use in tests via env
  process.env.E2E_TEST_ORG_ID = org.id;
  process.env.E2E_TEST_PROJECT_ID = project.id;
  process.env.E2E_DB_AVAILABLE = "true";

  console.log("[e2e/seed] E2E fixtures ready.");

  return {
    orgId: org.id,
    projectId: project.id,
    folderId: folder.id,
    adminUserId: adminUser.id,
    fiscalUserId: fiscalUser.id,
    tecnicoUserId: tecnicoUser.id,
    issueId: issue.id,
  };
}

async function createUser(data: {
  email: string;
  password: string;
  name: string;
}) {
  const passwordHash = await hash(data.password, 12);
  return prisma.user.upsert({
    where: { email: data.email },
    update: { passwordHash },
    create: {
      email: data.email,
      name: data.name,
      passwordHash,
      emailVerified: new Date(),
    },
  });
}

export async function cleanupE2EData(): Promise<void> {
  console.log("[e2e/seed] Disconnecting DB...");
  await prisma.$disconnect();
  console.log("[e2e/seed] Done.");
}

// Default export for use as playwright globalSetup
export default seedE2EData;
