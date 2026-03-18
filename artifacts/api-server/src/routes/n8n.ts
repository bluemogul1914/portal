/**
 * n8n Integration API
 * Secure endpoints for the Blue Mogul n8n agent at n8n.bluemogul.us
 *
 * All routes require: Authorization: Bearer <BOOKKEEPER_API_KEY>
 *
 * Endpoints used by n8n workflows:
 *  GET  /api/n8n/clients        → "Get Active Clients" node
 *  GET  /api/n8n/overdue        → "Get Overdue Invoices" node
 *  GET  /api/n8n/pnl            → "Build Weekly P&L Report" node
 *  POST /api/n8n/log            → "Log to Blue Mogul Portal" node
 *  POST /api/n8n/transaction    → Create a transaction from n8n
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { transactionsTable, vendorsTable } from "@workspace/db/schema";
import { eq, gte, lte, and, desc, sql } from "drizzle-orm";

const router: IRouter = Router();
const WAVE_API_URL = "https://gql.waveapps.com/graphql/public";
const BIZ_ID = "QnVzaW5lc3M6ZmI1M2YxMjgtYTg5ZC00MjBhLWJhOWMtNGRjZTVmNDhhNjI2";

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = process.env.BOOKKEEPER_API_KEY;
  if (!key) return res.status(503).json({ error: "API key not configured on server" });

  const auth = req.headers["authorization"] || req.headers["x-api-key"];
  const provided = typeof auth === "string"
    ? auth.replace(/^Bearer\s+/i, "").trim()
    : null;

  if (!provided || provided !== key) {
    return res.status(401).json({ error: "Unauthorized — invalid or missing API key" });
  }
  next();
}

// ── Public info endpoint (no auth) for UI display ─────────────────────────────
router.get("/n8n/info", (_req, res) => {
  const key = process.env.BOOKKEEPER_API_KEY || "";
  // Prefer REPLIT_DOMAINS for the public-facing URL
  const replitDomain = (process.env.REPLIT_DOMAINS || "").split(",")[0].trim();
  const baseUrl = replitDomain
    ? `https://${replitDomain}`
    : `${_req.protocol}://${_req.get("host")}`;
  res.json({
    configured: !!key,
    keyHint: key ? `${key.slice(0, 8)}...${key.slice(-4)}` : null,
    plaidConfigured: !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET),
    plaidBankLinked: !!process.env.PLAID_ACCESS_TOKEN,
    baseUrl,
    endpoints: [
      { method: "GET",  path: "/api/n8n/clients",     description: "List active clients from Wave" },
      { method: "GET",  path: "/api/n8n/overdue",     description: "Get overdue invoices" },
      { method: "GET",  path: "/api/n8n/pnl",         description: "Weekly/Monthly P&L report (?period=week|month|ytd)" },
      { method: "POST", path: "/api/n8n/log",         description: "Log n8n events to bookkeeper" },
      { method: "POST", path: "/api/n8n/transaction", description: "Create a transaction from n8n" },
      { method: "GET",  path: "/api/n8n/vendors",     description: "Get vendors list" },
    ],
  });
});

router.use("/n8n", requireApiKey);

// ── GET /api/n8n/status ── health check for n8n ────────────────────────────
router.get("/n8n/status", (_req, res) => {
  res.json({
    ok: true,
    service: "Blue Mogul Bookkeeper API",
    timestamp: new Date().toISOString(),
  });
});

// ── GET /api/n8n/clients ── active customers for Monthly Invoicing workflow ──
router.get("/n8n/clients", async (_req, res) => {
  const apiKey = process.env.WAVE_API_KEY;
  if (!apiKey) return res.json({ clients: [] });

  try {
    const resp = await fetch(WAVE_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{
          business(id: "${BIZ_ID}") {
            customers(page: 1, pageSize: 100) {
              pageInfo { totalCount }
              edges {
                node {
                  id
                  name
                  email
                  mobile
                  phone
                  currency { code }
                  address { city province { name } country { name } }
                }
              }
            }
          }
        }`,
      }),
    });
    const data = await resp.json() as any;
    const edges = data?.data?.business?.customers?.edges || [];
    const clients = edges.map((e: any) => ({
      id: e.node.id,
      name: e.node.name,
      email: e.node.email || null,
      phone: e.node.phone || e.node.mobile || null,
      currency: e.node.currency?.code || "USD",
      city: e.node.address?.city || null,
      state: e.node.address?.province?.name || null,
      country: e.node.address?.country?.name || null,
    }));
    res.json({ clients, total: clients.length, source: "wave", timestamp: new Date().toISOString() });
  } catch (e) {
    console.error("n8n/clients error:", e);
    res.status(500).json({ error: "Failed to fetch clients from Wave" });
  }
});

// ── GET /api/n8n/overdue ── overdue invoices for Weekly AR Check workflow ────
router.get("/n8n/overdue", async (_req, res) => {
  const apiKey = process.env.WAVE_API_KEY;
  if (!apiKey) return res.json({ invoices: [], total: 0 });

  try {
    const resp = await fetch(WAVE_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{
          business(id: "${BIZ_ID}") {
            invoices(page: 1, pageSize: 50) {
              edges {
                node {
                  id invoiceNumber invoiceDate status
                  total { value currency { code } }
                  amountDue { value }
                  customer { name email }
                }
              }
            }
          }
        }`,
      }),
    });
    const data = await resp.json() as any;
    const edges = data?.data?.business?.invoices?.edges || [];
    const today = new Date();
    const overdue = edges
      .filter((e: any) => e.node.status === "OVERDUE")
      .map((e: any) => {
        const inv = e.node;
        const dueDate = new Date(inv.invoiceDate);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: inv.invoiceDate,
          daysOverdue,
          customer: inv.customer?.name || "Unknown",
          customerEmail: inv.customer?.email || null,
          total: parseFloat(inv.total?.value || "0"),
          amountDue: parseFloat(inv.amountDue?.value || "0"),
          currency: inv.total?.currency?.code || "USD",
        };
      })
      .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);

    const totalDue = overdue.reduce((s: number, i: any) => s + i.amountDue, 0);
    res.json({
      invoices: overdue,
      total: overdue.length,
      totalAmountDue: totalDue,
      currency: "USD",
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("n8n/overdue error:", e);
    res.status(500).json({ error: "Failed to fetch overdue invoices" });
  }
});

// ── GET /api/n8n/pnl ── P&L summary for Weekly P&L Report workflow ───────────
router.get("/n8n/pnl", async (req, res) => {
  try {
    const { period = "month" } = req.query as { period?: string };

    const now = new Date();
    let startDate: string;

    if (period === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString().split("T")[0];
    } else if (period === "ytd") {
      startDate = `${now.getFullYear()}-01-01`;
    } else {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }

    const endDate = now.toISOString().split("T")[0];

    const rows = await db
      .select()
      .from(transactionsTable)
      .where(and(gte(transactionsTable.date, startDate), lte(transactionsTable.date, endDate)));

    const income = rows.filter(r => r.type === "income").reduce((s, r) => s + parseFloat(r.amount as string), 0);
    const expenses = rows.filter(r => r.type === "expense").reduce((s, r) => s + parseFloat(r.amount as string), 0);
    const netIncome = income - expenses;

    const byCategory = rows.reduce((acc: Record<string, number>, r) => {
      acc[r.category] = (acc[r.category] || 0) + parseFloat(r.amount as string);
      return acc;
    }, {});

    const recent = rows
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map(r => ({ date: r.date, description: r.description, amount: parseFloat(r.amount as string), type: r.type, category: r.category }));

    res.json({
      period,
      startDate,
      endDate,
      income,
      expenses,
      netIncome,
      profitMargin: income > 0 ? ((netIncome / income) * 100).toFixed(1) : "0",
      transactionCount: rows.length,
      byCategory,
      recentTransactions: recent,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("n8n/pnl error:", e);
    res.status(500).json({ error: "Failed to generate P&L report" });
  }
});

// ── POST /api/n8n/log ── "Log to Blue Mogul Portal" node ─────────────────────
router.post("/n8n/log", async (req, res) => {
  try {
    const {
      event = "n8n_event",
      workflow,
      data,
      severity = "info",
    } = req.body || {};

    // Store as a note transaction so it's auditable in the bookkeeper
    if (data?.amount && data?.description) {
      await db.insert(transactionsTable).values({
        date: new Date().toISOString().split("T")[0],
        description: `[n8n:${workflow || event}] ${data.description}`,
        amount: String(Math.abs(parseFloat(data.amount))),
        type: data.type || "income",
        category: data.category || "n8n Automation",
        source: "n8n",
        taxDeductible: false,
        notes: JSON.stringify({ workflow, event, severity, raw: data }),
      });
    }

    console.log(`[n8n log] ${severity.toUpperCase()} | ${workflow} | ${event}`, data);
    res.json({
      received: true,
      event,
      workflow,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("n8n/log error:", e);
    res.status(500).json({ error: "Failed to log n8n event" });
  }
});

// ── POST /api/n8n/transaction ── create a transaction from n8n ───────────────
router.post("/n8n/transaction", async (req, res) => {
  try {
    const { date, description, amount, type, category, notes } = req.body || {};
    if (!description || !amount || !type) {
      return res.status(400).json({ error: "description, amount, and type are required" });
    }
    const [row] = await db.insert(transactionsTable).values({
      date: date || new Date().toISOString().split("T")[0],
      description,
      amount: String(parseFloat(amount)),
      type,
      category: category || (type === "income" ? "Revenue" : "Expenses"),
      source: "n8n",
      taxDeductible: type === "expense",
      notes: notes || null,
    }).returning();
    res.json({ success: true, transaction: row });
  } catch (e) {
    console.error("n8n/transaction error:", e);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

// ── GET /api/n8n/vendors ── vendor list for n8n ───────────────────────────────
router.get("/n8n/vendors", async (_req, res) => {
  try {
    const rows = await db.select().from(vendorsTable).orderBy(vendorsTable.name);
    res.json({ vendors: rows, total: rows.length, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
});

export default router;
