import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable, taxItemsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard", async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    const ytdStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const [monthIncome] = await db.select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "income"), gte(transactionsTable.date, `${monthStr}-01`), lte(transactionsTable.date, `${monthStr}-31`)));

    const [monthExpense] = await db.select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "expense"), gte(transactionsTable.date, `${monthStr}-01`), lte(transactionsTable.date, `${monthStr}-31`)));

    const [ytdIncome] = await db.select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "income"), gte(transactionsTable.date, ytdStart)));

    const [ytdExpense] = await db.select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "expense"), gte(transactionsTable.date, ytdStart)));

    const [unreconciledCount] = await db.select({ count: sql<string>`count(*)` })
      .from(transactionsTable)
      .where(eq(transactionsTable.reconciled, false));

    const [outstandingTax] = await db.select({ total: sql<string>`coalesce(sum(${taxItemsTable.amount}), 0)` })
      .from(taxItemsTable)
      .where(and(eq(taxItemsTable.year, year), eq(taxItemsTable.paid, false)));

    const recentTransactions = await db.select().from(transactionsTable).orderBy(sql`${transactionsTable.createdAt} desc`).limit(5);

    const upcomingTaxDates = await db.select().from(taxItemsTable)
      .where(and(eq(taxItemsTable.paid, false), gte(taxItemsTable.dueDate, monthStr + "-01")))
      .orderBy(taxItemsTable.dueDate)
      .limit(3);

    const currentMonthRevenue = parseFloat(monthIncome?.total || "0");
    const currentMonthExpenses = parseFloat(monthExpense?.total || "0");
    const ytdRevenue = parseFloat(ytdIncome?.total || "0");
    const ytdExpenses = parseFloat(ytdExpense?.total || "0");

    res.json({
      currentMonthRevenue,
      currentMonthExpenses,
      currentMonthNet: currentMonthRevenue - currentMonthExpenses,
      ytdRevenue,
      ytdExpenses,
      ytdNet: ytdRevenue - ytdExpenses,
      outstandingTaxes: parseFloat(outstandingTax?.total || "0"),
      unreconciledCount: parseInt(unreconciledCount?.count || "0"),
      cashBalance: ytdRevenue - ytdExpenses,
      recentTransactions: recentTransactions.map(r => ({ ...r, amount: parseFloat(r.amount) })),
      upcomingTaxDates: upcomingTaxDates.map(r => ({ ...r, amount: parseFloat(r.amount) })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

router.get("/cashflow", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: "startDate and endDate required" });

    const incomeRows = await db.select({
      total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)`,
    }).from(transactionsTable).where(and(
      eq(transactionsTable.type, "income"),
      gte(transactionsTable.date, startDate as string),
      lte(transactionsTable.date, endDate as string)
    ));

    const expenseRows = await db.select({
      total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)`,
    }).from(transactionsTable).where(and(
      eq(transactionsTable.type, "expense"),
      gte(transactionsTable.date, startDate as string),
      lte(transactionsTable.date, endDate as string)
    ));

    const monthlyIncome = await db.select({
      month: sql<string>`to_char(${transactionsTable.date}::date, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)`,
    }).from(transactionsTable).where(and(
      eq(transactionsTable.type, "income"),
      gte(transactionsTable.date, startDate as string),
      lte(transactionsTable.date, endDate as string)
    )).groupBy(sql`to_char(${transactionsTable.date}::date, 'YYYY-MM')`).orderBy(sql`to_char(${transactionsTable.date}::date, 'YYYY-MM')`);

    const monthlyExpense = await db.select({
      month: sql<string>`to_char(${transactionsTable.date}::date, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)`,
    }).from(transactionsTable).where(and(
      eq(transactionsTable.type, "expense"),
      gte(transactionsTable.date, startDate as string),
      lte(transactionsTable.date, endDate as string)
    )).groupBy(sql`to_char(${transactionsTable.date}::date, 'YYYY-MM')`).orderBy(sql`to_char(${transactionsTable.date}::date, 'YYYY-MM')`);

    const byCategory = await db.select({
      category: transactionsTable.category,
      type: transactionsTable.type,
      total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)`,
    }).from(transactionsTable).where(and(
      gte(transactionsTable.date, startDate as string),
      lte(transactionsTable.date, endDate as string)
    )).groupBy(transactionsTable.category, transactionsTable.type);

    const incomeMap = new Map(monthlyIncome.map(r => [r.month, parseFloat(r.total)]));
    const expenseMap = new Map(monthlyExpense.map(r => [r.month, parseFloat(r.total)]));
    const allMonths = [...new Set([...incomeMap.keys(), ...expenseMap.keys()])].sort();

    const totalInflow = parseFloat(incomeRows[0]?.total || "0");
    const totalOutflow = parseFloat(expenseRows[0]?.total || "0");

    res.json({
      startDate,
      endDate,
      totalInflow,
      totalOutflow,
      netCashflow: totalInflow - totalOutflow,
      openingBalance: 0,
      closingBalance: totalInflow - totalOutflow,
      byMonth: allMonths.map(month => ({
        month,
        inflow: incomeMap.get(month) || 0,
        outflow: expenseMap.get(month) || 0,
        net: (incomeMap.get(month) || 0) - (expenseMap.get(month) || 0),
      })),
      byCategory: byCategory.map(r => ({ category: r.category, amount: parseFloat(r.total), type: r.type })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to generate cashflow report" });
  }
});

router.get("/profit-loss", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: "startDate and endDate required" });

    const [grossRevenue] = await db.select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable).where(and(eq(transactionsTable.type, "income"), gte(transactionsTable.date, startDate as string), lte(transactionsTable.date, endDate as string)));

    const [totalExpenses] = await db.select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable).where(and(eq(transactionsTable.type, "expense"), gte(transactionsTable.date, startDate as string), lte(transactionsTable.date, endDate as string)));

    const incomeByCategory = await db.select({
      category: transactionsTable.category,
      type: transactionsTable.type,
      total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)`,
    }).from(transactionsTable).where(and(eq(transactionsTable.type, "income"), gte(transactionsTable.date, startDate as string), lte(transactionsTable.date, endDate as string)))
      .groupBy(transactionsTable.category, transactionsTable.type);

    const expensesByCategory = await db.select({
      category: transactionsTable.category,
      type: transactionsTable.type,
      total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)`,
    }).from(transactionsTable).where(and(eq(transactionsTable.type, "expense"), gte(transactionsTable.date, startDate as string), lte(transactionsTable.date, endDate as string)))
      .groupBy(transactionsTable.category, transactionsTable.type);

    const revenue = parseFloat(grossRevenue?.total || "0");
    const expenses = parseFloat(totalExpenses?.total || "0");

    res.json({
      startDate,
      endDate,
      grossRevenue: revenue,
      costOfGoodsSold: 0,
      grossProfit: revenue,
      totalExpenses: expenses,
      netIncome: revenue - expenses,
      incomeByCategory: incomeByCategory.map(r => ({ category: r.category, amount: parseFloat(r.total), type: r.type })),
      expensesByCategory: expensesByCategory.map(r => ({ category: r.category, amount: parseFloat(r.total), type: r.type })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to generate P&L report" });
  }
});

export default router;
