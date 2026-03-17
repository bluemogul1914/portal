import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, type SQL } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const { type, category, startDate, endDate, reconciled } = req.query;
    const conditions: SQL[] = [];
    if (type) conditions.push(eq(transactionsTable.type, type as string));
    if (category) conditions.push(eq(transactionsTable.category, category as string));
    if (startDate) conditions.push(gte(transactionsTable.date, startDate as string));
    if (endDate) conditions.push(lte(transactionsTable.date, endDate as string));
    if (reconciled !== undefined) conditions.push(eq(transactionsTable.reconciled, reconciled === "true"));

    const rows = conditions.length
      ? await db.select().from(transactionsTable).where(and(...conditions)).orderBy(transactionsTable.date)
      : await db.select().from(transactionsTable).orderBy(transactionsTable.date);

    const formatted = rows.map(r => ({
      ...r,
      amount: parseFloat(r.amount),
    }));
    res.json(formatted);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { date, description, amount, type, category, subcategory, taxDeductible, notes } = req.body;
    if (!date || !description || amount == null || !type || !category) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const [row] = await db.insert(transactionsTable).values({
      date,
      description,
      amount: String(amount),
      type,
      category,
      subcategory: subcategory || null,
      taxDeductible: taxDeductible ?? false,
      notes: notes || null,
      source: "manual",
    }).returning();
    res.status(201).json({ ...row, amount: parseFloat(row.amount) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id));
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ ...row, amount: parseFloat(row.amount) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { date, description, amount, type, category, subcategory, taxDeductible, notes } = req.body;
    const updates: Partial<typeof transactionsTable.$inferInsert> = {};
    if (date !== undefined) updates.date = date;
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = String(amount);
    if (type !== undefined) updates.type = type;
    if (category !== undefined) updates.category = category;
    if (subcategory !== undefined) updates.subcategory = subcategory;
    if (taxDeductible !== undefined) updates.taxDeductible = taxDeductible;
    if (notes !== undefined) updates.notes = notes;

    const [row] = await db.update(transactionsTable).set(updates).where(eq(transactionsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ ...row, amount: parseFloat(row.amount) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(transactionsTable).where(eq(transactionsTable.id, id));
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

router.post("/:id/reconcile", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { bankAmount, notes } = req.body;
    if (bankAmount == null) return res.status(400).json({ error: "bankAmount required" });
    const [row] = await db.update(transactionsTable).set({
      reconciled: true,
      reconciledAt: new Date(),
      notes: notes || undefined,
    }).where(eq(transactionsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ ...row, amount: parseFloat(row.amount) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to reconcile" });
  }
});

export default router;
