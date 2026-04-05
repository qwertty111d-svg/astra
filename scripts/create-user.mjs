import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || "User";

if (!email || !password) {
  console.error("Использование: node scripts/create-user.mjs email password [name]");
  process.exit(1);
}

const dataDir = path.join(process.cwd(), "data");
const usersFile = path.join(dataDir, "users.json");

await mkdir(dataDir, { recursive: true });

let users = [];
try {
  const raw = await readFile(usersFile, "utf8");
  users = JSON.parse(raw);
  if (!Array.isArray(users)) users = [];
} catch {
  users = [];
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
const passwordHash = `scrypt$${salt}$${hash}`;

const now = new Date().toISOString();
const id = randomBytes(12).toString("hex");

users.push({
  id,
  name,
  email,
  emailVerified: true,
  pendingEmail: null,
  pendingEmailVerificationToken: null,
  passwordHash,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  pendingTwoFactorSecret: null,
  plan: null,
  subscriptionEndsAt: null,
  createdAt: now,
  updatedAt: now,
});

await writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
console.log("Пользователь создан:", email);
console.log("ID:", id);