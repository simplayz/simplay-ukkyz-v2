import { defineConfig } from "drizzle-kit";

const rawDriver = process.env.DATABASE_DRIVER?.trim().toLowerCase();
const isPostgres = rawDriver === "postgres" || rawDriver === "postgresql" || rawDriver === "pg";

function resolveSqliteConfigUrl(): string {
  const explicit = process.env.SQLITE_PATH?.trim();
  if (explicit) return explicit;
  const rawUrl = process.env.DATABASE_URL?.trim();
  if (!rawUrl || rawUrl.startsWith("postgres://") || rawUrl.startsWith("postgresql://")) {
    return "file:./simplayz.db";
  }
  return rawUrl;
}

export default isPostgres
  ? defineConfig({
      dialect: "postgresql",
      schema: "./src/db/schema.ts",
      out: "./drizzle",
      dbCredentials: {
        url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
      },
    })
  : defineConfig({
      dialect: "sqlite",
      schema: "./src/db/schema.ts",
      out: "./drizzle",
      dbCredentials: {
        url: resolveSqliteConfigUrl(),
      },
    });
