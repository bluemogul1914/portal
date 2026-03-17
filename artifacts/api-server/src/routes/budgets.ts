import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { budgetsTable, transactionsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, sql, type SQL } from "drizzle-orm";

const router: IRouter = Router();

router.get("/summary", async (req, res) => {
  try {
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);
    if (!year || !month) return res.status(400).json({ error: "year and month required" });

    const budgets = await db.select().from(budgetsTable).where(
      and(eq(budgetsTable.year, year), eq(budgetsTable.month, month))
    );

    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    const actuals = await db.select({
      category: transactionsTable.category,
      total: sql<string>`sum(${transactionsTable.amount})`,
    }).from(transactionsTable)
      .where(and(
        eq(transactionsTable.type, "expense"),
        gte(transactionsTable.date, `${monthStr}-01`),
        lte(transactionsTable.date, `${monthStr}-31`)
      ))
      .groupBy(transactionsTable.category);

    const actualsMap = new Map(actuals.map(a => [a.category, parseFloat(a.total || "0")]));

    const summary = budgets.map(b => {
      const budgeted = parseFloat(b.amount);
      const actual = actualsMap.get(b.category) || 0;
      const variance = budgeted - actual;
      return {
        category: b.category,
        budgeted,
        actual,
        variance,
        percentUsed: budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0,
      };
    });

    res.json(summary);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get budget summary" });
  }
});

router.get("/", async (req, res) => {
  try {
    const conditions: SQL[] = [];
    if (req.query.year) conditions.push(eq(budgetsTable.year, parseInt(req.query.year as string)));
    if (req.query.month) conditions.push(eq(budgetsTable.month, parseInt(req.query.month as string)));

    const rows = conditions.length
      ? await db.select().from(budgetsTable).where(and(...conditions))
      : await db.select().from(budgetsTable);

    res.json(rows.map(r => ({ ...r, amount: parseFloat(r.amount) })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch budgets" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { year, month, category, amount, notes } = req.body;
    if (!year || !category || amount == null) return res.status(400).json({ error: "Missing required fields" });
    const [row] = await db.insert(budgetsTable).values({
      year,
      month: month || null,
      category,
      amount: String(amount),
      notes: notes || null,
    }).returning();
    res.status(201).json({ ...row, amount: parseFloat(row.amount) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create budget" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { amount, notes } = req.body;
    const updates: Partial<typeof budgetsTable.$inferInsert> = {};
    if (amount !== undefined) updates.amount = String(amount);
    if (notes !== undefined) updates.notes = notes;
    const [row] = await db.update(budgetsTable).set(updates).where(eq(budgetsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ ...row, amount: parseFloat(row.amount) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update budget" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(budgetsTable).where(eq(budgetsTable.id, id));
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete budget" });
  }
});

export default router;
