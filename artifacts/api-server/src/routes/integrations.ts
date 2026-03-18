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

// ── STRIPE ────────────────────────────────────────────────────────────────────
// Uses STRIPE_KEY env var (sk_live_... or sk_test_...) for direct Stripe API access

function getStripeKey(): string | null {
  return process.env.STRIPE_KEY || process.env.STRIPE_SECRET_KEY || null;
}

async function stripeGet(path: string): Promise<Response> {
  const key = getStripeKey();
  if (!key) throw new Error("Stripe secret key not configured");
  return fetch(`https://api.stripe.com${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
}

router.get("/stripe/status", async (_req, res) => {
  const key = getStripeKey();
  if (!key) {
    return res.json({ connected: false, lastSynced: null, message: "Stripe secret key not configured" });
  }
  try {
    const response = await stripeGet("/v1/balance");
    const data = await response.json() as any;

    if (response.ok && data?.object === "balance") {
      return res.json({ connected: true, lastSynced: null, message: "Stripe connected" });
    }
    if (data?.error?.type === "authentication_error") {
      return res.json({ connected: false, lastSynced: null, message: "Stripe authentication failed — check your API key" });
    }
    res.json({ connected: true, lastSynced: null, message: "Stripe connected" });
  } catch (e) {
    console.error("Stripe status error:", e);
    res.json({ connected: false, lastSynced: null, message: "Could not reach Stripe API" });
  }
});

router.post("/stripe/sync", async (_req, res) => {
  const key = getStripeKey();
  if (!key) {
    return res.json({ success: false, imported: 0, message: "Stripe secret key not configured. Add STRIPE_KEY to environment secrets." });
  }
  try {
    const response = await stripeGet("/v1/charges?limit=100&expand[]=data.customer");

    if (!response.ok) {
      const data = await response.json() as any;
      console.error("Stripe sync error:", data);
      return res.json({ success: false, imported: 0, message: data?.error?.message || "Stripe API error" });
    }

    const data = await response.json() as any;
    const charges: any[] = data.data || [];
    let imported = 0;

    for (const charge of charges) {
      if (charge.status !== "succeeded") continue;

      const sourceId = charge.id;
      const existing = await db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.sourceId, sourceId))
        .limit(1);

      if (existing.length === 0) {
        const date = new Date(charge.created * 1000).toISOString().split("T")[0];
        const customerName =
          (typeof charge.customer === "object" ? charge.customer?.name : null) ||
          charge.billing_details?.name ||
          "Customer";
        const description = charge.description || `Stripe payment from ${customerName}`;
        const amountDollars = String(charge.amount / 100);

        await db.insert(transactionsTable).values({
          date,
          description,
          amount: amountDollars,
          type: "income",
          category: "Stripe Revenue",
          source: "stripe",
          sourceId,
          taxDeductible: false,
        });
        imported++;
      }
    }

    res.json({
      success: true,
      imported,
      message: imported > 0
        ? `Successfully imported ${imported} new Stripe payment${imported === 1 ? "" : "s"}`
        : "All Stripe payments are already up to date",
    });
  } catch (e) {
    console.error("Stripe sync error:", e);
    res.json({ success: false, imported: 0, message: "Failed to sync Stripe data" });
  }
});

// ── WAVE: overdue invoices for dashboard alert panel ─────────────────────────
router.get("/wave/overdue", async (_req, res) => {
  const apiKey = process.env.WAVE_API_KEY;
  if (!apiKey) return res.json({ invoices: [] });

  try {
    const bizResp = await fetch(WAVE_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ businesses(page:1,pageSize:5){ edges{ node{ id name } } } }` }),
    });
    const bizData = await bizResp.json() as any;
    const businesses: any[] = bizData?.data?.businesses?.edges || [];
    const targetBiz = businesses.find((b: any) => b.node.name.toLowerCase().includes("blue mogul")) || businesses[0];
    if (!targetBiz) return res.json({ invoices: [] });

    const invResp = await fetch(WAVE_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{
          business(id: "${targetBiz.node.id}") {
            invoices(page:1, pageSize:20) {
              edges {
                node {
                  id invoiceNumber invoiceDate status
                  total { value }
                  amountDue { value }
                  customer { name }
                }
              }
            }
          }
        }`,
      }),
    });
    const invData = await invResp.json() as any;
    const edges: any[] = invData?.data?.business?.invoices?.edges || [];
    const overdue = edges
      .filter((e: any) => e.node.status === "OVERDUE")
      .map((e: any) => ({
        id: e.node.id,
        invoiceNumber: e.node.invoiceNumber,
        date: e.node.invoiceDate,
        status: e.node.status,
        total: parseFloat(e.node.total?.value || "0"),
        amountDue: parseFloat(e.node.amountDue?.value || "0"),
        customer: e.node.customer?.name || "Unknown",
      }));

    res.json({ invoices: overdue });
  } catch (e) {
    console.error("Wave overdue error:", e);
    res.json({ invoices: [] });
  }
});

export default router;
