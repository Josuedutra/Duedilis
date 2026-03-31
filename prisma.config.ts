import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // For migrations, set DATABASE_URL to the direct (non-pooled) Neon URL
    // Runtime queries use the pooled URL via the PrismaPg adapter in src/lib/prisma.ts
    url: process.env["DATABASE_URL"],
  },
});
