import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();

const WAVE_API_URL = "https://gql.waveapps.com/graphql/public";

// ── WAVE ─────────────────────────────────────────────────────────────────────

router.get("/wave/status", async (_req, res) => {
  const apiKey = process.env.WAVE_API_KEY;
  res.json({
    connected: !!apiKey,
    lastSynced: null,
    message: apiKey
      ? "Wave Accounting connected"
      : "Wave API key not configured. Add WAVE_API_KEY to environment variables.",
  });
});

router.post("/wave/sync", async (_req, res) => {
  const apiKey = process.env.WAVE_API_KEY;
  if (!apiKey) {
    return res.json({
      success: false,
      imported: 0,
      message: "Wave API key not configured. Please add WAVE_API_KEY to your environment secrets.",
    });
  }

  try {
    // Step 1: Get the Blue Mogul Enterprise, LLC business ID
    const bizQuery = `{
      businesses(page: 1, pageSize: 10) {
        edges {
          node {
            id
            name
          }
        }
      }
    }`;

    const bizResp = await fetch(WAVE_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: bizQuery }),
    });
    const bizData = await bizResp.json() as any;
    const businesses: any[] = bizData?.data?.businesses?.edges || [];

    // Prefer Blue Mogul Enterprise, LLC; fall back to first business
    const targetBiz =
      businesses.find((b: any) => b.node.name.toLowerCase().includes("blue mogul")) ||
      businesses[0];

    if (!targetBiz) {
      return res.json({ success: false, imported: 0, message: "No Wave business found" });
    }

    const bizId = targetBiz.node.id;
    let imported = 0;
    let page = 1;
    let hasMore = true;

    // Step 2: Page through all invoices and import them
    while (hasMore) {
      const invoiceQuery = `{
        business(id: "${bizId}") {
          invoices(page: ${page}, pageSize: 50) {
            pageInfo { totalCount currentPage totalPages }
            edges {
              node {
                id
                invoiceNumber
                invoiceDate
                status
                total { value currency { code } }
                amountDue { value }
                customer { name }
              }
            }
          }
        }
      }`;

      const invResp = await fetch(WAVE_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: invoiceQuery }),
      });
      const invData = await invResp.json() as any;
      const invoicesPage = invData?.data?.business?.invoices;

      if (!invoicesPage) break;

      const { totalPages, currentPage } = invoicesPage.pageInfo;
      const edges: any[] = invoicesPage.edges || [];

      for (const edge of edges) {
        const inv = edge.node;
        // Only import paid invoices as confirmed income
        if (inv.status !== "PAID" && inv.status !== "PARTIAL") continue;

        const amount = parseFloat(inv.total?.value || "0");
        if (amount <= 0) continue;

        const sourceId = `wave-inv-${inv.id}`;
        const existing = await db
          .select()
          .from(transactionsTable)
          .where(eq(transactionsTable.sourceId, sourceId))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(transactionsTable).values({
            date: inv.invoiceDate || new Date().toISOString().split("T")[0],
            description: `Invoice #${inv.invoiceNumber}${inv.customer?.name ? ` – ${inv.customer.name}` : ""}`,
            amount: String(amount),
            type: "income",
            category: "Consulting Revenue",
            source: "wave",
            sourceId,
            taxDeductible: false,
          });
          imported++;
        }
      }

      hasMore = currentPage < totalPages;
      page++;
    }

    res.json({
      success: true,
      imported,
      message: imported > 0
        ? `Successfully imported ${imported} paid invoices from Wave (${targetBiz.node.name})`
        : "All Wave invoices are already up to date",
    });
  } catch (e) {
    console.error("Wave sync error:", e);
    res.json({ success: false, imported: 0, message: "Failed to sync Wave data" });
  }
});

// ── STRIPE (via Replit Connectors SDK) ───────────────────────────────────────

router.get("/stripe/status", async (_req, res) => {
  try {
    const connectors = new ReplitConnectors();
    // Probe connectivity — any response from Stripe's API (even 404) means we're authenticated
    const response = await connectors.proxy("stripe", "/v1/charges?limit=1", { method: "GET" });
    const data = await response.json() as any;

    // 200 with data array = connected and has charges
    if (response.ok && Array.isArray(data?.data)) {
      return res.json({
        connected: true,
        lastSynced: null,
        message: "Stripe connected via Replit integration",
      });
    }

    // Stripe returned a structured error message = we're authenticated, Stripe responded
    // "Unrecognized request URL" in sandbox = connected, sandbox mode
    if (data?.error?.type === "invalid_request_error") {
      return res.json({
        connected: true,
        lastSynced: null,
        message: "Stripe connected (sandbox mode)",
      });
    }

    // Auth errors = not connected
    if (data?.error?.type === "authentication_error" || data?.error?.code === "api_key_expired") {
      return res.json({
        connected: false,
        lastSynced: null,
        message: "Stripe authentication failed",
      });
    }

    // Any other Stripe response = connected
    res.json({ connected: true, lastSynced: null, message: "Stripe connected" });
  } catch (e) {
    console.error("Stripe status error:", e);
    res.json({ connected: false, lastSynced: null, message: "Stripe connector not reachable" });
  }
});

router.post("/stripe/sync", async (_req, res) => {
  try {
    const connectors = new ReplitConnectors();

    const response = await connectors.proxy("stripe", "/v1/charges?limit=50", {
      method: "GET",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Stripe sync error response:", text);
      return res.json({
        success: false,
        imported: 0,
        message: `Stripe API error: ${response.statusText}`,
      });
    }

    const data = await response.json() as any;
    const charges: any[] = data.data || [];
    let imported = 0;

    for (const charge of charges) {
      if (charge.status !== "succeeded") continue;

      const existing = await db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.sourceId, charge.id))
        .limit(1);

      if (existing.length === 0) {
        const date = new Date(charge.created * 1000).toISOString().split("T")[0];
        const description =
          charge.description ||
          `Stripe payment from ${charge.billing_details?.name || "customer"}`;
        const amountDollars = String(charge.amount / 100);

        await db.insert(transactionsTable).values({
          date,
          description,
          amount: amountDollars,
          type: "income",
          category: "Stripe Revenue",
          source: "stripe",
          sourceId: charge.id,
          taxDeductible: false,
        });
        imported++;
      }
    }

    res.json({
      success: true,
      imported,
      message:
        imported > 0
          ? `Successfully imported ${imported} new payments from Stripe`
          : "All Stripe payments are already up to date",
    });
  } catch (e) {
    console.error("Stripe sync error:", e);
    res.json({ success: false, imported: 0, message: "Failed to sync Stripe data" });
  }
});

export default router;
