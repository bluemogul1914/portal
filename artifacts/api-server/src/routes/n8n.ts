/**
 * n8n Integration API — Blue Mogul Bookkeeper
 * Base URL: https://<replit-domain>
 * Auth:     X-Api-Key: <BOOKKEEPER_API_KEY>
 *           — OR — Authorization: Bearer <BOOKKEEPER_API_KEY>
 *
 * Endpoints:
 *  GET /api/n8n/summary        → YTD income, expenses, net profit, margin
 *  GET /api/n8n/cashflow       → Monthly breakdown (current year, Jan–current month)
 *  GET /api/n8n/invoices       → All Wave invoices with status
 *  GET /api/n8n/taxes          → TX sales tax 8.25% + SE tax on net profit
 *  GET /api/n8n/reconciliation → Unreconciled transactions
 *  GET /api/n8n/overdue        → Overdue invoices
 *  GET /api/n8n/clients        → Active clients from Wave
 *  GET /api/n8n/pnl            → P&L by period (legacy, kept for compat)
 *  GET /api/n8n/vendors        → Vendor list
 *  POST /api/n8n/log           → Log an event from n8n to bookkeeper
 *  POST /api/n8n/transaction   → Create a transaction from n8n
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { transactionsTable, vendorsTable, reconciliationSessionsTable } from "@workspace/db/schema";
import { eq, gte, lte, and, desc, sql, ne } from "drizzle-orm";

const router: IRouter = Router();
const WAVE_API_URL = "https://gql.waveapps.com/graphql/public";
const BIZ_ID = "QnVzaW5lc3M6ZmI1M2YxMjgtYTg5ZC00MjBhLWJhOWMtNGRjZTVmNDhhNjI2";
const BIZ_NAME = "Blue Mogul Enterprise, LLC";
const TX_SALES_TAX_RATE = 0.0825;   // Texas sales tax
const SE_TAX_RATE = 0.153;          // Self-employment tax rate (15.3%)
const SE_NET_FACTOR = 0.9235;       // IRS: SE tax on 92.35% of net earnings

// ─── Helpers ─────────────────────────────────────────────────────────────────

function waveHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

async function fetchWaveInvoices(apiKey: string, statusFilter?: string): Promise<any[]> {
  let page = 1;
  let hasMore = true;
  const all: any[] = [];

  while (hasMore) {
    const resp = await fetch(WAVE_API_URL, {
      method: "POST",
      headers: waveHeaders(apiKey),
      body: JSON.stringify({
        query: `{
          business(id: "${BIZ_ID}") {
            invoices(page: ${page}, pageSize: 50) {
              pageInfo { totalCount currentPage totalPages }
              edges {
                node {
                  id invoiceNumber invoiceDate status
                  total { value currency { code } }
                  amountDue { value }
                  amountPaid { value }
                  customer { name email }
                  memo
                }
              }
            }
          }
        }`,
      }),
    });
    const data = await resp.json() as any;
    const pg = data?.data?.business?.invoices;
    if (!pg) break;

    const edges: any[] = pg.edges || [];
    for (const e of edges) {
      const inv = e.node;
      if (!statusFilter || inv.status === statusFilter) all.push(inv);
    }
    hasMore = pg.pageInfo.currentPage < pg.pageInfo.totalPages;
    page++;
  }
  return all;
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const serverKey = process.env.BOOKKEEPER_API_KEY;
  if (!serverKey) return res.status(503).json({ error: "API key not configured on server" });

  // Accept X-Api-Key, x-api-key, or Authorization: Bearer <key>
  const raw =
    req.headers["x-api-key"] ||
    req.headers["authorization"];
  const provided = typeof raw === "string"
    ? raw.replace(/^Bearer\s+/i, "").trim()
    : null;

  if (!provided || provided !== serverKey) {
    return res.status(401).json({
      error: "Unauthorized",
      hint: "Provide your API key via X-Api-Key header or Authorization: Bearer <key>",
    });
  }
  next();
}

// ─── Public info endpoint (no auth) ──────────────────────────────────────────
router.get("/n8n/info", (_req, res) => {
  const key = process.env.BOOKKEEPER_API_KEY || "";
  const replitDomain = (process.env.REPLIT_DOMAINS || "").split(",")[0].trim();
  const baseUrl = replitDomain
    ? `https://${replitDomain}`
    : `${_req.protocol}://${_req.get("host")}`;
  res.json({
    service: "Blue Mogul Bookkeeper API",
    configured: !!key,
    keyHint: key ? `${key.slice(0, 8)}...${key.slice(-4)}` : null,
    authHeader: "X-Api-Key: <BOOKKEEPER_API_KEY>",
    plaidConfigured: !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET),
    plaidBankLinked: !!process.env.PLAID_ACCESS_TOKEN,
    baseUrl,
    endpoints: [
      { method: "GET",  path: "/api/n8n/summary",        description: "YTD income, expenses, net profit, margin" },
      { method: "GET",  path: "/api/n8n/cashflow",        description: "Monthly cash flow breakdown (current year)" },
      { method: "GET",  path: "/api/n8n/invoices",        description: "All Wave invoices with status (?status=OVERDUE|PAID|DRAFT|SENT)" },
      { method: "GET",  path: "/api/n8n/taxes",           description: "TX sales tax 8.25% + SE tax on net profit" },
      { method: "GET",  path: "/api/n8n/reconciliation",  description: "Unreconciled transactions" },
      { method: "GET",  path: "/api/n8n/overdue",         description: "Overdue invoices with days past due" },
      { method: "GET",  path: "/api/n8n/clients",         description: "Active clients from Wave" },
      { method: "GET",  path: "/api/n8n/vendors",         description: "Vendor list" },
      { method: "POST", path: "/api/n8n/log",             description: "Log a workflow event to bookkeeper" },
      { method: "POST", path: "/api/n8n/transaction",     description: "Create a transaction record" },
    ],
  });
});

// Apply auth to all /n8n/* routes below
router.use("/n8n", requireApiKey);

// ─── GET /api/n8n/status ─────────────────────────────────────────────────────
router.get("/n8n/status", (_req, res) => {
  res.json({ ok: true, service: BIZ_NAME, timestamp: new Date().toISOString() });
});

// ─── GET /api/n8n/summary ────────────────────────────────────────────────────
// Returns YTD financial summary combining Wave invoices + local DB transactions
router.get("/n8n/summary", async (_req, res) => {
  try {
    const year = new Date().getFullYear();
    const ytdStart = `${year}-01-01`;
    const ytdEnd = new Date().toISOString().split("T")[0];

    const rows = await db
      .select()
      .from(transactionsTable)
      .where(and(gte(transactionsTable.date, ytdStart), lte(transactionsTable.date, ytdEnd)));

    const income   = rows.filter(r => r.type === "income").reduce((s, r)  => s + parseFloat(r.amount as string), 0);
    const expenses = rows.filter(r => r.type === "expense").reduce((s, r) => s + parseFloat(r.amount as string), 0);
    const net      = income - expenses;
    const margin   = income > 0 ? parseFloat(((net / income) * 100).toFixed(2)) : 0;

    // Largest income categories
    const incomeByCategory = rows
      .filter(r => r.type === "income")
      .reduce((acc: Record<string, number>, r) => {
        acc[r.category] = (acc[r.category] || 0) + parseFloat(r.amount as string);
        return acc;
      }, {});

    // Largest expense categories
    const expensesByCategory = rows
      .filter(r => r.type === "expense")
      .reduce((acc: Record<string, number>, r) => {
        acc[r.category] = (acc[r.category] || 0) + parseFloat(r.amount as string);
        return acc;
      }, {});

    res.json({
      business: BIZ_NAME,
      period: "YTD",
      year,
      startDate: ytdStart,
      endDate: ytdEnd,
      summary: {
        totalIncome:   parseFloat(income.toFixed(2)),
        totalExpenses: parseFloat(expenses.toFixed(2)),
        netProfit:     parseFloat(net.toFixed(2)),
        profitMargin:  margin,
        transactionCount: rows.length,
      },
      incomeByCategory,
      expensesByCategory,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("n8n/summary error:", e);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

// ─── GET /api/n8n/cashflow ───────────────────────────────────────────────────
// Monthly cash flow breakdown for the current year
router.get("/n8n/cashflow", async (_req, res) => {
  try {
    const year = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const ytdStart = `${year}-01-01`;
    const ytdEnd = new Date().toISOString().split("T")[0];

    const rows = await db
      .select()
      .from(transactionsTable)
      .where(and(gte(transactionsTable.date, ytdStart), lte(transactionsTable.date, ytdEnd)));

    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const monthly: Record<number, { inflow: number; outflow: number; net: number; transactions: number }> = {};
    for (let m = 1; m <= currentMonth; m++) monthly[m] = { inflow: 0, outflow: 0, net: 0, transactions: 0 };

    for (const r of rows) {
      const m = parseInt(r.date.slice(5, 7), 10);
      if (!monthly[m]) continue;
      const amt = parseFloat(r.amount as string);
      if (r.type === "income")  { monthly[m].inflow  += amt; }
      else                       { monthly[m].outflow += amt; }
      monthly[m].transactions++;
    }

    const breakdown = Object.entries(monthly).map(([m, v]) => ({
      month:        MONTH_NAMES[Number(m) - 1],
      monthNumber:  Number(m),
      year,
      inflow:       parseFloat(v.inflow.toFixed(2)),
      outflow:      parseFloat(v.outflow.toFixed(2)),
      net:          parseFloat((v.inflow - v.outflow).toFixed(2)),
      transactions: v.transactions,
    }));

    const totals = breakdown.reduce(
      (acc, m) => ({ inflow: acc.inflow + m.inflow, outflow: acc.outflow + m.outflow, net: acc.net + m.net }),
      { inflow: 0, outflow: 0, net: 0 }
    );

    res.json({
      business: BIZ_NAME,
      year,
      monthsReported: currentMonth,
      monthly: breakdown,
      totals: {
        inflow:  parseFloat(totals.inflow.toFixed(2)),
        outflow: parseFloat(totals.outflow.toFixed(2)),
        net:     parseFloat(totals.net.toFixed(2)),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("n8n/cashflow error:", e);
    res.status(500).json({ error: "Failed to generate cash flow report" });
  }
});

// ─── GET /api/n8n/invoices ───────────────────────────────────────────────────
// All Wave invoices. Optional ?status=OVERDUE|PAID|DRAFT|SENT|PARTIAL|VIEWED
router.get("/n8n/invoices", async (req, res) => {
  const apiKey = process.env.WAVE_API_KEY;
  if (!apiKey) return res.json({ invoices: [], total: 0, error: "Wave API key not configured" });

  try {
    const { status } = req.query as { status?: string };
    const all = await fetchWaveInvoices(apiKey, status?.toUpperCase());
    const today = new Date();

    const invoices = all.map((inv: any) => {
      const dueDate = new Date(inv.invoiceDate);
      const daysOverdue = inv.status === "OVERDUE"
        ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        id:            inv.id,
        invoiceNumber: inv.invoiceNumber,
        date:          inv.invoiceDate,
        status:        inv.status,
        customer:      inv.customer?.name || "Unknown",
        customerEmail: inv.customer?.email || null,
        total:         parseFloat(inv.total?.value || "0"),
        amountDue:     parseFloat(inv.amountDue?.value || "0"),
        amountPaid:    parseFloat(inv.amountPaid?.value || "0"),
        currency:      inv.total?.currency?.code || "USD",
        daysOverdue:   daysOverdue > 0 ? daysOverdue : null,
        memo:          inv.memo || null,
      };
    });

    // Aggregate totals
    const totals = invoices.reduce(
      (acc: any, inv: any) => ({
        total:     acc.total     + inv.total,
        amountDue: acc.amountDue + inv.amountDue,
        paid:      acc.paid      + inv.amountPaid,
      }),
      { total: 0, amountDue: 0, paid: 0 }
    );

    const byStatus = invoices.reduce((acc: Record<string, number>, inv: any) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      business: BIZ_NAME,
      filter: status || "all",
      total:   invoices.length,
      byStatus,
      totals: {
        invoiced: parseFloat(totals.total.toFixed(2)),
        paid:     parseFloat(totals.paid.toFixed(2)),
        outstanding: parseFloat(totals.amountDue.toFixed(2)),
      },
      invoices,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("n8n/invoices error:", e);
    res.status(500).json({ error: "Failed to fetch invoices from Wave" });
  }
});

// ─── GET /api/n8n/taxes ──────────────────────────────────────────────────────
// Texas sales tax (8.25%) + Self-employment tax on net profit
router.get("/n8n/taxes", async (_req, res) => {
  try {
    const year = new Date().getFullYear();
    const ytdStart = `${year}-01-01`;
    const ytdEnd = new Date().toISOString().split("T")[0];

    const rows = await db
      .select()
      .from(transactionsTable)
      .where(and(gte(transactionsTable.date, ytdStart), lte(transactionsTable.date, ytdEnd)));

    const grossIncome  = rows.filter(r => r.type === "income") .reduce((s, r) => s + parseFloat(r.amount as string), 0);
    const totalExpenses = rows.filter(r => r.type === "expense").reduce((s, r) => s + parseFloat(r.amount as string), 0);
    const netProfit    = grossIncome - totalExpenses;

    // Texas Sales Tax: 8.25% on taxable sales (gross income)
    const txSalesTaxDue = grossIncome * TX_SALES_TAX_RATE;

    // Self-Employment Tax: 15.3% on 92.35% of net profit
    const seNetEarnings = Math.max(0, netProfit) * SE_NET_FACTOR;
    const seTaxDue      = seNetEarnings * SE_TAX_RATE;

    // Deductible half of SE tax (reduces income tax)
    const seDeduction = seTaxDue / 2;

    // Quarterly estimated tax (SE / 4 + rough federal income estimate)
    const federalIncomeEstimate = Math.max(0, netProfit - seDeduction) * 0.22; // 22% bracket estimate
    const quarterlyEstimate = (seTaxDue + federalIncomeEstimate) / 4;

    // Current quarter
    const month = new Date().getMonth() + 1;
    const quarter = Math.ceil(month / 3);

    res.json({
      business: BIZ_NAME,
      taxYear:  year,
      period: { startDate: ytdStart, endDate: ytdEnd },
      income: {
        grossIncome:    parseFloat(grossIncome.toFixed(2)),
        totalExpenses:  parseFloat(totalExpenses.toFixed(2)),
        netProfit:      parseFloat(netProfit.toFixed(2)),
      },
      texas: {
        salesTaxRate:   `${(TX_SALES_TAX_RATE * 100).toFixed(2)}%`,
        taxableSales:   parseFloat(grossIncome.toFixed(2)),
        salesTaxOwed:   parseFloat(txSalesTaxDue.toFixed(2)),
        note: "Texas imposes 8.25% state + local sales tax on taxable goods/services",
      },
      selfEmployment: {
        seTaxRate:      `${(SE_TAX_RATE * 100).toFixed(2)}%`,
        netEarningsBase: parseFloat(seNetEarnings.toFixed(2)),
        seTaxOwed:      parseFloat(seTaxDue.toFixed(2)),
        deductibleHalf: parseFloat(seDeduction.toFixed(2)),
        note: "SE tax = 15.3% on 92.35% of net profit (Social Security 12.4% + Medicare 2.9%)",
      },
      estimated: {
        currentQuarter:   `Q${quarter} ${year}`,
        quarterlyPayment: parseFloat(quarterlyEstimate.toFixed(2)),
        annualEstimate:   parseFloat((seTaxDue + federalIncomeEstimate).toFixed(2)),
        note: "Estimated federal quarterly payment due 15th of Apr/Jun/Sep/Jan",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("n8n/taxes error:", e);
    res.status(500).json({ error: "Failed to calculate taxes" });
  }
});

// ─── GET /api/n8n/reconciliation ────────────────────────────────────────────
// All unreconciled transactions from the DB
router.get("/n8n/reconciliation", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.reconciled, false))
      .orderBy(desc(transactionsTable.date));

    const income   = rows.filter(r => r.type === "income") .reduce((s, r) => s + parseFloat(r.amount as string), 0);
    const expenses = rows.filter(r => r.type === "expense").reduce((s, r) => s + parseFloat(r.amount as string), 0);

    const bySource = rows.reduce((acc: Record<string, number>, r) => {
      acc[r.source] = (acc[r.source] || 0) + 1;
      return acc;
    }, {});

    res.json({
      business: BIZ_NAME,
      unreconciledCount: rows.length,
      summary: {
        unreconciledIncome:   parseFloat(income.toFixed(2)),
        unreconciledExpenses: parseFloat(expenses.toFixed(2)),
        netUnreconciled:      parseFloat((income - expenses).toFixed(2)),
      },
      bySource,
      transactions: rows.map(r => ({
        id:          r.id,
        date:        r.date,
        description: r.description,
        amount:      parseFloat(r.amount as string),
        type:        r.type,
        category:    r.category,
        source:      r.source,
        notes:       r.notes || null,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("n8n/reconciliation error:", e);
    res.status(500).json({ error: "Failed to fetch unreconciled transactions" });
  }
});

// ─── GET /api/n8n/overdue ────────────────────────────────────────────────────
// Overdue invoices from Wave, sorted by most overdue first
router.get("/n8n/overdue", async (_req, res) => {
  const apiKey = process.env.WAVE_API_KEY;
  if (!apiKey) return res.json({ invoices: [], total: 0, totalAmountDue: 0 });

  try {
    const all = await fetchWaveInvoices(apiKey, "OVERDUE");
    const today = new Date();

    const invoices = all.map((inv: any) => {
      const dueDate = new Date(inv.invoiceDate);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        invoiceNumber: inv.invoiceNumber,
        date:          inv.invoiceDate,
        daysOverdue,
        agingBucket:   daysOverdue <= 30 ? "1-30" : daysOverdue <= 60 ? "31-60" : daysOverdue <= 90 ? "61-90" : "90+",
        customer:      inv.customer?.name || "Unknown",
        customerEmail: inv.customer?.email || null,
        amountDue:     parseFloat(inv.amountDue?.value || "0"),
        total:         parseFloat(inv.total?.value || "0"),
        currency:      inv.total?.currency?.code || "USD",
      };
    }).sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);

    const totalAmountDue = invoices.reduce((s: number, i: any) => s + i.amountDue, 0);

    res.json({
      business:     BIZ_NAME,
      total:        invoices.length,
      totalAmountDue: parseFloat(totalAmountDue.toFixed(2)),
      currency:     "USD",
      aging: {
        "1-30":  invoices.filter((i: any) => i.agingBucket === "1-30").length,
        "31-60": invoices.filter((i: any) => i.agingBucket === "31-60").length,
        "61-90": invoices.filter((i: any) => i.agingBucket === "61-90").length,
        "90+":   invoices.filter((i: any) => i.agingBucket === "90+").length,
      },
      invoices,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("n8n/overdue error:", e);
    res.status(500).json({ error: "Failed to fetch overdue invoices" });
  }
});

// ─── GET /api/n8n/clients ────────────────────────────────────────────────────
router.get("/n8n/clients", async (_req, res) => {
  const apiKey = process.env.WAVE_API_KEY;
  if (!apiKey) return res.json({ clients: [], total: 0 });

  try {
    const resp = await fetch(WAVE_API_URL, {
      method: "POST",
      headers: waveHeaders(apiKey),
      body: JSON.stringify({
        query: `{
          business(id: "${BIZ_ID}") {
            customers(page: 1, pageSize: 100) {
              pageInfo { totalCount }
              edges {
                node {
                  id name email mobile phone
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
      id:       e.node.id,
      name:     e.node.name,
      email:    e.node.email || null,
      phone:    e.node.phone || e.node.mobile || null,
      currency: e.node.currency?.code || "USD",
      city:     e.node.address?.city || null,
      state:    e.node.address?.province?.name || null,
      country:  e.node.address?.country?.name || null,
    }));
    res.json({ business: BIZ_NAME, clients, total: clients.length, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error("n8n/clients error:", e);
    res.status(500).json({ error: "Failed to fetch clients from Wave" });
  }
});

// ─── GET /api/n8n/pnl  (legacy — kept for backward compat) ───────────────────
router.get("/n8n/pnl", async (req, res) => {
  try {
    const { period = "month" } = req.query as { period?: string };
    const now = new Date();
    let startDate: string;

    if (period === "week") {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      startDate = d.toISOString().split("T")[0];
    } else if (period === "ytd") {
      startDate = `${now.getFullYear()}-01-01`;
    } else {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }
    const endDate = now.toISOString().split("T")[0];

    const rows = await db.select().from(transactionsTable)
      .where(and(gte(transactionsTable.date, startDate), lte(transactionsTable.date, endDate)));

    const income   = rows.filter(r => r.type === "income") .reduce((s, r) => s + parseFloat(r.amount as string), 0);
    const expenses = rows.filter(r => r.type === "expense").reduce((s, r) => s + parseFloat(r.amount as string), 0);
    const netIncome = income - expenses;

    res.json({
      period, startDate, endDate, income, expenses, netIncome,
      profitMargin: income > 0 ? ((netIncome / income) * 100).toFixed(1) : "0",
      transactionCount: rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate P&L" });
  }
});

// ─── GET /api/n8n/vendors ────────────────────────────────────────────────────
router.get("/n8n/vendors", async (_req, res) => {
  try {
    const rows = await db.select().from(vendorsTable).orderBy(vendorsTable.name);
    res.json({ business: BIZ_NAME, vendors: rows, total: rows.length, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
});

// ─── POST /api/n8n/log ───────────────────────────────────────────────────────
router.post("/n8n/log", async (req, res) => {
  try {
    const { event = "n8n_event", workflow, data, severity = "info" } = req.body || {};

    if (data?.amount && data?.description) {
      await db.insert(transactionsTable).values({
        date:        new Date().toISOString().split("T")[0],
        description: `[n8n:${workflow || event}] ${data.description}`,
        amount:      String(Math.abs(parseFloat(data.amount))),
        type:        data.type || "income",
        category:    data.category || "n8n Automation",
        source:      "n8n",
        taxDeductible: false,
        notes:       JSON.stringify({ workflow, event, severity, raw: data }),
      });
    }

    console.log(`[n8n log] ${severity.toUpperCase()} | ${workflow} | ${event}`);
    res.json({ received: true, event, workflow, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: "Failed to log n8n event" });
  }
});

// ─── POST /api/n8n/transaction ───────────────────────────────────────────────
router.post("/n8n/transaction", async (req, res) => {
  try {
    const { date, description, amount, type, category, notes } = req.body || {};
    if (!description || !amount || !type) {
      return res.status(400).json({ error: "description, amount, and type are required" });
    }
    const [row] = await db.insert(transactionsTable).values({
      date:         date || new Date().toISOString().split("T")[0],
      description,
      amount:       String(parseFloat(amount)),
      type,
      category:     category || (type === "income" ? "Revenue" : "Expenses"),
      source:       "n8n",
      taxDeductible: type === "expense",
      notes:        notes || null,
    }).returning();
    res.json({ success: true, transaction: row, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

export default router;
