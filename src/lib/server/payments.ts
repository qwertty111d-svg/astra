import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db.js";
import { readEnv } from "./env.js";
import { randomId, type UserRecord } from "./auth.js";
import { paymentRequests, users } from "./schema.js";

export type PaymentPlanKey = "PRO" | "LIFETIME";
export type PaymentRequestStatus = "pending" | "approved" | "rejected";

export type PaymentRequestRecord = {
  id: string;
  userId: string;
  plan: PaymentPlanKey;
  amountRub: number;
  status: PaymentRequestStatus;
  payerNote: string | null;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const PLAN_CONFIG: Record<PaymentPlanKey, { label: string; amountRub: number; durationDays: number | null; description: string; }> = {
  PRO: {
    label: "Pro",
    amountRub: 599,
    durationDays: 30,
    description: "Полный доступ на 30 дней.",
  },
  LIFETIME: {
    label: "Lifetime",
    amountRub: 1990,
    durationDays: null,
    description: "Полный доступ навсегда.",
  },
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapPaymentRequest(row: any): PaymentRequestRecord {
  return {
    id: row.id,
    userId: row.userId,
    plan: normalizePlan(row.plan),
    amountRub: Number(row.amountRub ?? 0),
    status: normalizeStatus(row.status),
    payerNote: row.payerNote ?? null,
    adminNote: row.adminNote ?? null,
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: toIso(row.reviewedAt),
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

export function normalizePlan(value: unknown): PaymentPlanKey {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "LIFETIME" ? "LIFETIME" : "PRO";
}

function normalizeStatus(value: unknown): PaymentRequestStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  return "pending";
}

export function getPlanConfig(plan: PaymentPlanKey) {
  return PLAN_CONFIG[normalizePlan(plan)];
}

export function listPlanConfigs() {
  return Object.entries(PLAN_CONFIG).map(([key, value]) => ({ key: key as PaymentPlanKey, ...value }));
}

export function isAdminEmail(email: string | null | undefined) {
  const adminEmails = readEnv("ADMIN_EMAILS")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.length) return false;
  return adminEmails.includes(String(email ?? "").trim().toLowerCase());
}

export async function ensurePaymentRequestsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payment_requests (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      plan text NOT NULL,
      amount_rub integer NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      payer_note text,
      admin_note text,
      reviewed_by text,
      reviewed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function getLatestPendingPaymentRequest(userId: string, plan?: PaymentPlanKey) {
  await ensurePaymentRequestsTable();
  const conditions = [eq(paymentRequests.userId, userId), eq(paymentRequests.status, "pending")];
  if (plan) conditions.push(eq(paymentRequests.plan, normalizePlan(plan)));

  const rows = await db
    .select()
    .from(paymentRequests)
    .where(and(...conditions))
    .orderBy(desc(paymentRequests.createdAt))
    .limit(1);

  return rows[0] ? mapPaymentRequest(rows[0]) : null;
}

export async function getPaymentRequestsForUser(userId: string) {
  await ensurePaymentRequestsTable();
  const rows = await db
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.userId, userId))
    .orderBy(desc(paymentRequests.createdAt))
    .limit(12);

  return rows.map(mapPaymentRequest);
}

export async function createPaymentRequest(input: { userId: string; plan: PaymentPlanKey; payerNote?: string | null; }) {
  await ensurePaymentRequestsTable();

  const plan = normalizePlan(input.plan);
  const config = getPlanConfig(plan);
  const payerNote = String(input.payerNote ?? "").trim().slice(0, 500) || null;

  const existingPending = await getLatestPendingPaymentRequest(input.userId, plan);
  if (existingPending) {
    if (payerNote !== existingPending.payerNote) {
      const rows = await db
        .update(paymentRequests)
        .set({
          payerNote,
          updatedAt: new Date(),
        })
        .where(eq(paymentRequests.id, existingPending.id))
        .returning();

      return mapPaymentRequest(rows[0] ?? existingPending);
    }

    return existingPending;
  }

  const now = new Date();
  const rows = await db
    .insert(paymentRequests)
    .values({
      id: randomId(16),
      userId: input.userId,
      plan,
      amountRub: config.amountRub,
      status: "pending",
      payerNote,
      adminNote: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return mapPaymentRequest(rows[0]);
}

export async function getPendingPaymentRequestsWithUsers() {
  await ensurePaymentRequestsTable();
  const rows = await db
    .select({
      id: paymentRequests.id,
      userId: paymentRequests.userId,
      plan: paymentRequests.plan,
      amountRub: paymentRequests.amountRub,
      status: paymentRequests.status,
      payerNote: paymentRequests.payerNote,
      adminNote: paymentRequests.adminNote,
      reviewedBy: paymentRequests.reviewedBy,
      reviewedAt: paymentRequests.reviewedAt,
      createdAt: paymentRequests.createdAt,
      updatedAt: paymentRequests.updatedAt,
      userEmail: users.email,
      userName: users.name,
      userPlan: users.plan,
      userSubscriptionEndsAt: users.subscriptionEndsAt,
    })
    .from(paymentRequests)
    .innerJoin(users, eq(paymentRequests.userId, users.id))
    .where(eq(paymentRequests.status, "pending"))
    .orderBy(desc(paymentRequests.createdAt));

  return rows.map((row) => ({
    request: mapPaymentRequest(row),
    user: {
      id: row.userId,
      email: row.userEmail,
      name: row.userName,
      plan: row.userPlan ?? null,
      subscriptionEndsAt: toIso(row.userSubscriptionEndsAt),
    },
  }));
}

function computeSubscriptionEnd(user: Pick<UserRecord, "plan" | "subscriptionEndsAt">, plan: PaymentPlanKey) {
  if (plan === "LIFETIME") {
    return new Date("2125-01-01T00:00:00.000Z");
  }

  const now = new Date();
  const currentEnd = user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : null;
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + (PLAN_CONFIG[plan].durationDays ?? 30));
  return next;
}

export async function approvePaymentRequest(input: { requestId: string; adminEmail: string; adminNote?: string | null; }) {
  await ensurePaymentRequestsTable();
  const requestRows = await db.select().from(paymentRequests).where(eq(paymentRequests.id, input.requestId)).limit(1);
  const requestRow = requestRows[0];
  if (!requestRow) throw new Error("Заявка не найдена.");
  const request = mapPaymentRequest(requestRow);

  if (request.status !== "pending") {
    throw new Error("Заявка уже обработана.");
  }

  const userRows = await db.select().from(users).where(eq(users.id, request.userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new Error("Пользователь не найден.");

  const nextSubscriptionEndsAt = computeSubscriptionEnd({
    plan: user.plan ?? null,
    subscriptionEndsAt: toIso(user.subscriptionEndsAt),
  } as UserRecord, request.plan);

  await db.update(users).set({
    plan: request.plan,
    subscriptionEndsAt: nextSubscriptionEndsAt,
    updatedAt: new Date(),
  }).where(eq(users.id, request.userId));

  const rows = await db.update(paymentRequests).set({
    status: "approved",
    adminNote: String(input.adminNote ?? "").trim() || null,
    reviewedBy: input.adminEmail,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(paymentRequests.id, input.requestId)).returning();

  return mapPaymentRequest(rows[0]);
}

export async function rejectPaymentRequest(input: { requestId: string; adminEmail: string; adminNote?: string | null; }) {
  await ensurePaymentRequestsTable();
  const requestRows = await db.select().from(paymentRequests).where(eq(paymentRequests.id, input.requestId)).limit(1);
  const requestRow = requestRows[0];
  if (!requestRow) throw new Error("Заявка не найдена.");

  const request = mapPaymentRequest(requestRow);
  if (request.status !== "pending") {
    throw new Error("Заявка уже обработана.");
  }

  const rows = await db.update(paymentRequests).set({
    status: "rejected",
    adminNote: String(input.adminNote ?? "").trim() || null,
    reviewedBy: input.adminEmail,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(paymentRequests.id, input.requestId)).returning();

  return mapPaymentRequest(rows[0]);
}
