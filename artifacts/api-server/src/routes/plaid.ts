/**
 * Plaid Integration — Relay Financial bank sync
 * Connects Relay Financial accounts via Plaid to import real transactions.
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function getPlaidConfig() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV || "sandbox";
  const configured = !!(clientId && secret);
  const baseUrl = env === "production"
    ? "https://production.plaid.com"
    : env === "development"
    ? "https://development.plaid.com"
    : "https://sandbox.plaid.com";
  return { clientId, secret, env, configured, baseUrl };
}

// ── GET /api/plaid/status ─────────────────────────────────────────────────────
router.get("/plaid/status", async (_req, res) => {
  const cfg = getPlaidConfig();
  if (!cfg.configured) {
    return res.json({
      connected: false,
      configured: false,
      message: "Add PLAID_CLIENT_ID and PLAID_SECRET to environment secrets",
      env: cfg.env,
    });
  }

  // Test credentials by hitting /institutions/get
  try {
    const resp = await fetch(`${cfg.baseUrl}/institutions/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: cfg.clientId,
        secret: cfg.secret,
        count: 1,
        offset: 0,
        country_codes: ["US"],
      }),
    });
    const data = await resp.json() as any;
    if (data.error_code) {
      return res.json({ connected: false, configured: true, message: data.error_message, env: cfg.env });
    }
    const accessTokenExists = !!process.env.PLAID_ACCESS_TOKEN;
    res.json({
      connected: true,
      configured: true,
      bankLinked: accessTokenExists,
      message: accessTokenExists
        ? `Plaid connected (${cfg.env}) — bank account linked`
        : `Plaid credentials valid (${cfg.env}) — click "Connect Bank" to link Relay Financial`,
      env: cfg.env,
    });
  } catch (e) {
    res.json({ connected: false, configured: true, message: "Cannot reach Plaid API", env: cfg.env });
  }
});

// ── POST /api/plaid/link-token ── create a Link token for Plaid Link UI ───────
router.post("/plaid/link-token", async (_req, res) => {
  const cfg = getPlaidConfig();
  if (!cfg.configured) {
    return res.status(503).json({ error: "Plaid credentials not configured" });
  }

  try {
    const resp = await fetch(`${cfg.baseUrl}/link/token/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: cfg.clientId,
        secret: cfg.secret,
        client_name: "Blue Mogul Bookkeeper",
        user: { client_user_id: "blue-mogul-enterprise" },
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
        institution_id: undefined,
      }),
    });
    const data = await resp.json() as any;
    if (data.error_code) {
      return res.status(400).json({ error: data.error_message });
    }
    res.json({ linkToken: data.link_token, expiration: data.expiration });
  } catch (e) {
    console.error("Plaid link-token error:", e);
    res.status(500).json({ error: "Failed to create Plaid link token" });
  }
});

// ── POST /api/plaid/exchange-token ── exchange public_token for access_token ──
router.post("/plaid/exchange-token", async (req, res) => {
  const cfg = getPlaidConfig();
  if (!cfg.configured) return res.status(503).json({ error: "Plaid not configured" });

  const { publicToken, institutionName } = req.body || {};
  if (!publicToken) return res.status(400).json({ error: "publicToken required" });

  try {
    const resp = await fetch(`${cfg.baseUrl}/item/public_token/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: cfg.clientId,
        secret: cfg.secret,
        public_token: publicToken,
      }),
    });
    const data = await resp.json() as any;
    if (data.error_code) return res.status(400).json({ error: data.error_message });

    // Store the access token as env var (in a real app, use encrypted DB storage)
    process.env.PLAID_ACCESS_TOKEN = data.access_token;
    process.env.PLAID_ITEM_ID = data.item_id;

    console.log(`[Plaid] Bank linked: ${institutionName || "Unknown"}, item: ${data.item_id}`);
    res.json({ success: true, institution: institutionName, itemId: data.item_id });
  } catch (e) {
    console.error("Plaid exchange error:", e);
    res.status(500).json({ error: "Failed to exchange Plaid token" });
  }
});

// ── POST /api/plaid/sync ── fetch bank transactions and import as expenses ─────
router.post("/plaid/sync", async (req, res) => {
  const cfg = getPlaidConfig();
  if (!cfg.configured) return res.json({ success: false, imported: 0, message: "Plaid not configured" });

  const accessToken = process.env.PLAID_ACCESS_TOKEN;
  if (!accessToken) return res.json({ success: false, imported: 0, message: "No bank account linked yet. Click 'Connect Bank' first." });

  try {
    const { days = 30 } = req.body || {};
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const resp = await fetch(`${cfg.baseUrl}/transactions/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: cfg.clientId,
        secret: cfg.secret,
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: { count: 500, offset: 0 },
      }),
    });

    const data = await resp.json() as any;
    if (data.error_code) {
      return res.json({ success: false, imported: 0, message: `Plaid error: ${data.error_message}` });
    }

    const transactions: any[] = data.transactions || [];
    let imported = 0;
    let skipped = 0;

    for (const txn of transactions) {
      if (txn.pending) { skipped++; continue; }

      const sourceId = `plaid-${txn.transaction_id}`;
      const existing = await db.select().from(transactionsTable).where(eq(transactionsTable.sourceId, sourceId)).limit(1);
      if (existing.length > 0) { skipped++; continue; }

      // Plaid: positive amount = money OUT (expense), negative = money IN (income)
      const isExpense = txn.amount > 0;
      const category = txn.personal_finance_category?.primary || txn.category?.[0] || (isExpense ? "Business Expense" : "Revenue");

      await db.insert(transactionsTable).values({
        date: txn.date,
        description: txn.merchant_name || txn.name || "Bank Transaction",
        amount: String(Math.abs(txn.amount)),
        type: isExpense ? "expense" : "income",
        category: mapPlaidCategory(category),
        source: "plaid",
        sourceId,
        taxDeductible: isExpense,
        notes: txn.account_id,
      });
      imported++;
    }

    res.json({
      success: true,
      imported,
      skipped,
      total: transactions.length,
      startDate,
      endDate,
      message: imported > 0
        ? `Imported ${imported} new bank transactions (${skipped} skipped)`
        : "All bank transactions are already up to date",
    });
  } catch (e) {
    console.error("Plaid sync error:", e);
    res.json({ success: false, imported: 0, message: "Failed to sync Plaid transactions" });
  }
});

// Map Plaid categories to our bookkeeper categories
function mapPlaidCategory(plaidCat: string): string {
  const map: Record<string, string> = {
    FOOD_AND_DRINK: "Travel & Meals",
    TRAVEL: "Travel & Meals",
    TRANSPORTATION: "Travel & Meals",
    RENT_AND_UTILITIES: "Utilities",
    GENERAL_MERCHANDISE: "Office Supplies",
    HOME_IMPROVEMENT: "Equipment",
    ENTERTAINMENT: "Marketing & Advertising",
    PERSONAL_CARE: "Other Expenses",
    GENERAL_SERVICES: "Professional Services",
    GOVERNMENT_AND_NON_PROFIT: "Other Expenses",
    TRANSFER_IN: "Revenue",
    TRANSFER_OUT: "Other Expenses",
    LOAN_PAYMENTS: "Other Expenses",
    BANK_FEES: "Other Expenses",
    INCOME: "Revenue",
    TAX: "Tax Payments",
  };
  return map[plaidCat] || "Business Expense";
}

export default router;
