import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getRequiredEnv } from "./env.js";

const client = postgres(getRequiredEnv("DATABASE_URL"), {
  prepare: false,
});

export const db = drizzle(client);
