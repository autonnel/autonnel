import 'dotenv/config'
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { 
    url: process.env.DATABASE_URL ?? "postgresql://dummy:dummy@localhost:5432/dummy",
  }
});