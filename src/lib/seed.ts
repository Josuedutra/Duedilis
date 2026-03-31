import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create demo organization
  const org = await prisma.organization.upsert({
    where: { slug: "duedilis-demo" },
    update: {},
    create: {
      slug: "duedilis-demo",
      name: "Duedilis Demo",
      description: "Demo organization for testing",
    },
  });

  console.log(`Organization created: ${org.name} (${org.id})`);

  // Create admin user
  const user = await prisma.user.upsert({
    where: { email: "admin@duedilis.com" },
    update: {},
    create: {
      email: "admin@duedilis.com",
      name: "Admin Duedilis",
      emailVerified: new Date(),
    },
  });

  console.log(`User created: ${user.email} (${user.id})`);

  // Add user as org admin
  const membership = await prisma.orgMembership.upsert({
    where: {
      userId_orgId: {
        userId: user.id,
        orgId: org.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      orgId: org.id,
      role: "ADMIN_ORG",
    },
  });

  console.log(
    `Membership created: ${user.email} → ${org.slug} (${membership.role})`,
  );
  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
