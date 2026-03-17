import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { taxItemsTable, transactionsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, sql, type SQL } from "drizzle-orm";

const router: IRouter = Router();

router.get("/summary", async (req, res) => {
  try {
    const year = parseInt(req.query.year as string);
    if (!year) return res.status(400).json({ error: "year required" });

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const incomeRows = await db.select({
      total: sql<string>`sum(${transactionsTable.amount})`,
    }).from(transactionsTable).where(and(
      eq(transactionsTable.type, "income"),
      gte(transactionsTable.date, startDate),
      lte(transactionsTable.date, endDate)
    ));

    const expenseRows = await db.select({
      total: sql<string>`sum(${transactionsTable.amount})`,
    }).from(transactionsTable).where(and(
      eq(transactionsTable.type, "expense"),
      gte(transactionsTable.date, startDate),
      lte(transactionsTable.date, endDate)
    ));

    const deductibleRows = await db.select({
      category: transactionsTable.category,
      total: sql<string>`sum(${transactionsTable.amount})`,
    }).from(transactionsTable).where(and(
      eq(transactionsTable.type, "expense"),
      eq(transactionsTable.taxDeductible, true),
      gte(transactionsTable.date, startDate),
      lte(transactionsTable.date, endDate)
    )).groupBy(transactionsTable.category);

    const salesTaxRows = await db.select({
      total: sql<string>`sum(${taxItemsTable.amount})`,
    }).from(taxItemsTable).where(and(
      eq(taxItemsTable.year, year),
      eq(taxItemsTable.type, "sales_tax")
    ));

    const estimatedTaxRows = await db.select({
      total: sql<string>`sum(${taxItemsTable.amount})`,
    }).from(taxItemsTable).where(and(
      eq(taxItemsTable.year, year),
      eq(taxItemsTable.type, "estimated_quarterly"),
      eq(taxItemsTable.paid, true)
    ));

    const totalRevenue = parseFloat(incomeRows[0]?.total || "0");
    const totalExpenses = parseFloat(expenseRows[0]?.total || "0");
    const totalDeductions = deductibleRows.reduce((sum, r) => sum + parseFloat(r.total || "0"), 0);
    const netIncome = totalRevenue - totalExpenses;
    const taxableIncome = Math.max(0, netIncome - totalDeductions);

    const quarterBreakdown = await Promise.all([1, 2, 3, 4].map(async q => {
      const qStart = `${year}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
      const qEnd = `${year}-${String(q * 3).padStart(2, "0")}-${q === 4 ? "31" : "30"}`;
      const [qIncome] = await db.select({ total: sql<string>`sum(${transactionsTable.amount})` })
        .from(transactionsTable).where(and(eq(transactionsTable.type, "income"), gte(transactionsTable.date, qStart), lte(transactionsTable.date, qEnd)));
      const [qExpense] = await db.select({ total: sql<string>`sum(${transactionsTable.amount})` })
        .from(transactionsTable).where(and(eq(transactionsTable.type, "expense"), gte(transactionsTable.date, qStart), lte(transactionsTable.date, qEnd)));
      const qRevenue = parseFloat(qIncome?.total || "0");
      const qExpenses = parseFloat(qExpense?.total || "0");
      const qNet = qRevenue - qExpenses;
      return { quarter: q, revenue: qRevenue, expenses: qExpenses, netIncome: qNet, estimatedTaxDue: Math.max(0, qNet * 0.25) };
    }));

    res.json({
      year,
      totalRevenue,
      totalExpenses,
      netIncome,
      totalDeductions,
      taxableIncome,
      salesTaxCollected: parseFloat(salesTaxRows[0]?.total || "0"),
      estimatedTaxPaid: parseFloat(estimatedTaxRows[0]?.total || "0"),
      quarterBreakdown,
      topDeductions: deductibleRows.map(r => ({ category: r.category, amount: parseFloat(r.total || "0") })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get tax summary" });
  }
});

router.get("/", async (req, res) => {
  try {
    const conditions: SQL[] = [];
    if (req.query.year) conditions.push(eq(taxItemsTable.year, parseInt(req.query.year as string)));
    if (req.query.quarter) conditions.push(eq(taxItemsTable.quarter, parseInt(req.query.quarter as string)));
    if (req.query.type) conditions.push(eq(taxItemsTable.type, req.query.type as string));

    const rows = conditions.length
      ? await db.select().from(taxItemsTable).where(and(...conditions))
      : await db.select().from(taxItemsTable);

    res.json(rows.map(r => ({ ...r, amount: parseFloat(r.amount) })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch tax items" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { year, quarter, type, description, amount, dueDate, notes } = req.body;
    if (!year || !type || !description || amount == null) return res.status(400).json({ error: "Missing required fields" });
    const [row] = await db.insert(taxItemsTable).values({
      year,
      quarter: quarter || null,
      type,
      description,
      amount: String(amount),
      dueDate: dueDate || null,
      notes: notes || null,
    }).returning();
    res.status(201).json({ ...row, amount: parseFloat(row.amount) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create tax item" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { description, amount, dueDate, paid, paidDate, notes } = req.body;
    const updates: Partial<typeof taxItemsTable.$inferInsert> = {};
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = String(amount);
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (paid !== undefined) updates.paid = paid;
    if (paidDate !== undefined) updates.paidDate = paidDate;
    if (notes !== undefined) updates.notes = notes;
    const [row] = await db.update(taxItemsTable).set(updates).where(eq(taxItemsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ ...row, amount: parseFloat(row.amount) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update tax item" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(taxItemsTable).where(eq(taxItemsTable.id, id));
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete tax item" });
  }
});

export default router;
