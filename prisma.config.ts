
import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    "Database URL missing! Check DATABASE_URL_UNPOOLED and DATABASE_URL in Vercel Environment Variables."
  );
}

console.log("Prisma database URL configured:", true);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
