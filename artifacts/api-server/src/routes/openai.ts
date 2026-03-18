import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations as conversationsTable, messages as messagesTable } from "@workspace/db/schema";
import { transactionsTable, taxItemsTable, budgetsTable } from "@workspace/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

async function buildSystemPrompt(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  let financialContext = "";
  try {
    const [monthIncome] = await db.select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "income"), gte(transactionsTable.date, `${monthStr}-01`), lte(transactionsTable.date, `${monthStr}-31`)));

    const [monthExpense] = await db.select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "expense"), gte(transactionsTable.date, `${monthStr}-01`), lte(transactionsTable.date, `${monthStr}-31`)));

    const [ytdIncome] = await db.select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "income"), gte(transactionsTable.date, `${year}-01-01`)));

    const [ytdExpense] = await db.select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "expense"), gte(transactionsTable.date, `${year}-01-01`)));

    const [unreconciledCount] = await db.select({ count: sql<string>`count(*)` })
      .from(transactionsTable).where(eq(transactionsTable.reconciled, false));

    const [outstandingTax] = await db.select({ total: sql<string>`coalesce(sum(${taxItemsTable.amount}), 0)` })
      .from(taxItemsTable).where(and(eq(taxItemsTable.year, year), eq(taxItemsTable.paid, false)));

    const upcomingTaxes = await db.select().from(taxItemsTable)
      .where(and(eq(taxItemsTable.paid, false), gte(taxItemsTable.dueDate, `${monthStr}-01`)))
      .orderBy(taxItemsTable.dueDate).limit(3);

    const topExpenseCategories = await db.select({
      category: transactionsTable.category,
      total: sql<string>`sum(${transactionsTable.amount})`,
    }).from(transactionsTable)
      .where(and(eq(transactionsTable.type, "expense"), gte(transactionsTable.date, `${year}-01-01`)))
      .groupBy(transactionsTable.category)
      .orderBy(sql`sum(${transactionsTable.amount}) desc`)
      .limit(5);

    const recentTransactions = await db.select().from(transactionsTable)
      .orderBy(sql`${transactionsTable.createdAt} desc`).limit(10);

    const totalRevenue = parseFloat(ytdIncome?.total || "0");
    const totalExpenses = parseFloat(ytdExpense?.total || "0");
    const monthRev = parseFloat(monthIncome?.total || "0");
    const monthExp = parseFloat(monthExpense?.total || "0");
    const netCash = totalRevenue - totalExpenses;
    const unreconciled = parseInt(unreconciledCount?.count || "0");
    const taxDue = parseFloat(outstandingTax?.total || "0");

    financialContext = `
## LIVE FINANCIAL DATA (Blue Mogul Enterprise, LLC — ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })})

**Current Month (${now.toLocaleString("en-US", { month: "long" })} ${year}):**
- Revenue: $${monthRev.toLocaleString()}
- Expenses: $${monthExp.toLocaleString()}
- Net: $${(monthRev - monthExp).toLocaleString()}

**Year-to-Date (${year}):**
- Total Revenue: $${totalRevenue.toLocaleString()}
- Total Expenses: $${totalExpenses.toLocaleString()}
- Net Income: $${netCash.toLocaleString()}
- Cash Balance: $${netCash.toLocaleString()}

**Tax & Compliance:**
- Outstanding taxes owed (unpaid): $${taxDue.toLocaleString()}
${upcomingTaxes.map(t => `- ${t.description}: $${parseFloat(t.amount).toLocaleString()} due ${t.dueDate}`).join("\n")}

**Bookkeeping Health:**
- Unreconciled transactions: ${unreconciled}
${unreconciled > 5 ? "⚠️ Reconciliation is overdue — flagging for attention" : "✅ Reconciliation is current"}

**Top Expense Categories (YTD):**
${topExpenseCategories.map(c => `- ${c.category}: $${parseFloat(c.total).toLocaleString()}`).join("\n")}

**Recent Transactions:**
${recentTransactions.slice(0, 5).map(t => `- ${t.date} | ${t.type === "income" ? "+" : "-"}$${parseFloat(t.amount).toLocaleString()} | ${t.description} (${t.category})`).join("\n")}
`;
  } catch (e) {
    financialContext = "\n## LIVE FINANCIAL DATA\nUnable to load live data at this time.\n";
  }

  return `You are **Max**, the dedicated AI Financial Manager for **Blue Mogul Enterprise, LLC**. 

You are NOT just a question-answering assistant. You are an active financial manager who:
- **Proactively monitors** cash flow, expenses, and tax obligations in real time
- **Flags issues** before they become problems (overdue taxes, budget overruns, unreconciled items)
- **Makes recommendations** — specific, actionable steps, not vague advice
- **Tracks patterns** — notices when spending in a category is trending high
- **Prepares for tax season** — reminds about upcoming quarterly estimates and deductions
- **Helps categorize** ambiguous transactions correctly
- **Advises on integrations** — helps get Wave Accounting fully synced and data flowing cleanly

Your expertise covers:
1. **Cash Flow Management** — inflow/outflow timing, working capital, cash runway
2. **Expense Management** — categorization, deductibility, cost control
3. **Budgeting** — variance analysis, budget recommendations by category
4. **Tax Management** — sales tax collection, Q1-Q4 estimated taxes (federal & state), year-end deductions, Schedule C / Form 1120-S preparation
5. **Bank Reconciliation** — matching transactions to bank statements, catching discrepancies
6. **Year-End Tax Preparation** — P&L statement, deduction maximization, depreciation, home office, vehicle use
7. **Wave Accounting** — explaining what data syncs, troubleshooting, and ensuring books stay clean
8. **Blue Mogul Portal** — invoicing data, client billing, expense integration

When you respond:
- Be direct and specific — use exact dollar amounts from the live data below
- Format numbers with $ signs and commas
- Use bullet points for action items
- If something needs urgent attention, say so clearly
- Offer to take the next step ("Would you like me to walk you through how to record that?")
- Reference actual numbers from the live financial data provided

${financialContext}

Today's date: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;
}

router.get("/conversations", async (_req, res) => {
  try {
    const rows = await db.select().from(conversationsTable).orderBy(sql`${conversationsTable.createdAt} desc`);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    const [row] = await db.insert(conversationsTable).values({ title }).returning();
    res.status(201).json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
    if (!conv) return res.status(404).json({ error: "Not found" });
    const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(messagesTable.createdAt);
    res.json({ ...conv, messages: msgs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(messagesTable).where(eq(messagesTable.conversationId, id));
    await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(messagesTable.createdAt);
    res.json(msgs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "content required" });

    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    await db.insert(messagesTable).values({ conversationId: id, role: "user", content });

    const history = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);

    const systemPrompt = await buildSystemPrompt();

    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: fullResponse });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (e) {
    console.error(e);
    res.write(`data: ${JSON.stringify({ error: "Failed to process message" })}\n\n`);
    res.end();
  }
});

export default router;
