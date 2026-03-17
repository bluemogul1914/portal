import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reconciliationSessionsTable, transactionsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/sessions", async (req, res) => {
  try {
    const rows = await db.select().from(reconciliationSessionsTable).orderBy(sql`${reconciliationSessionsTable.createdAt} desc`);
    res.json(rows.map(r => ({
      ...r,
      statementBalance: parseFloat(r.statementBalance),
      computedBalance: r.computedBalance ? parseFloat(r.computedBalance) : null,
      difference: r.difference ? parseFloat(r.difference) : null,
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const { accountName, statementDate, statementBalance } = req.body;
    if (!accountName || !statementDate || statementBalance == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const [row] = await db.insert(reconciliationSessionsTable).values({
      accountName,
      statementDate,
      statementBalance: String(statementBalance),
    }).returning();
    res.status(201).json({
      ...row,
      statementBalance: parseFloat(row.statementBalance),
      computedBalance: null,
      difference: null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.post("/sessions/:id/complete", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [session] = await db.select().from(reconciliationSessionsTable).where(eq(reconciliationSessionsTable.id, id));
    if (!session) return res.status(404).json({ error: "Not found" });

    const [computed] = await db.select({ total: sql<string>`coalesce(sum(case when type = 'income' then amount::numeric else -amount::numeric end), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.reconciled, true)));

    const computedBalance = parseFloat(computed?.total || "0");
    const statementBalance = parseFloat(session.statementBalance);
    const difference = computedBalance - statementBalance;

    const [updated] = await db.update(reconciliationSessionsTable).set({
      computedBalance: String(computedBalance),
      difference: String(difference),
      status: "completed",
      completedAt: new Date(),
    }).where(eq(reconciliationSessionsTable.id, id)).returning();

    res.json({
      ...updated,
      statementBalance: parseFloat(updated.statementBalance),
      computedBalance: parseFloat(updated.computedBalance || "0"),
      difference: parseFloat(updated.difference || "0"),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to complete session" });
  }
});

export default router;
