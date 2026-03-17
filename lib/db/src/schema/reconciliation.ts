import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reconciliationSessionsTable = pgTable("reconciliation_sessions", {
  id: serial("id").primaryKey(),
  accountName: text("account_name").notNull(),
  statementDate: text("statement_date").notNull(),
  statementBalance: numeric("statement_balance", { precision: 12, scale: 2 }).notNull(),
  computedBalance: numeric("computed_balance", { precision: 12, scale: 2 }),
  difference: numeric("difference", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("in_progress"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReconciliationSessionSchema = createInsertSchema(reconciliationSessionsTable).omit({ id: true, createdAt: true });
export type InsertReconciliationSession = z.infer<typeof insertReconciliationSessionSchema>;
export type ReconciliationSession = typeof reconciliationSessionsTable.$inferSelect;
