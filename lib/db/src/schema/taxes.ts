import { pgTable, text, serial, boolean, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taxItemsTable = pgTable("tax_items", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  quarter: integer("quarter"),
  type: text("type").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: text("due_date"),
  paid: boolean("paid").notNull().default(false),
  paidDate: text("paid_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaxItemSchema = createInsertSchema(taxItemsTable).omit({ id: true, createdAt: true });
export type InsertTaxItem = z.infer<typeof insertTaxItemSchema>;
export type TaxItem = typeof taxItemsTable.$inferSelect;
