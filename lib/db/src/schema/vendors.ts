import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  website: text("website"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  province: text("province"),
  country: text("country"),
  postalCode: text("postal_code"),
  currency: text("currency").default("USD"),
  displayId: text("display_id"),
  source: text("source").notNull().default("manual"),
  sourceId: text("source_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendorsTable.$inferSelect;
