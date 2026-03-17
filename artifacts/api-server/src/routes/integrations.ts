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
    const query = `
      query {
        businesses {
          edges {
            node {
              id
              name
              transactions(first: 50) {
                edges {
                  node {
                    id
                    description
                    amount
                    date
                    anchor { account { name } }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(WAVE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return res.json({
        success: false,
        imported: 0,
        message: `Wave API error: ${response.statusText}`,
      });
    }

    const data = await response.json() as any;
    const businesses = data?.data?.businesses?.edges || [];
    let imported = 0;

    for (const biz of businesses) {
      const txns = biz.node?.transactions?.edges || [];
      for (const edge of txns) {
        const tx = edge.node;
        const existing = await db
          .select()
          .from(transactionsTable)
          .where(eq(transactionsTable.sourceId, tx.id))
          .limit(1);
        if (existing.length === 0) {
          await db.insert(transactionsTable).values({
            date: tx.date,
            description: tx.description || "Wave transaction",
            amount: String(Math.abs(tx.amount)),
            type: tx.amount >= 0 ? "income" : "expense",
            category: tx.anchor?.account?.name || "Uncategorized",
            source: "wave",
            sourceId: tx.id,
            taxDeductible: false,
          });
          imported++;
        }
      }
    }

    res.json({
      success: true,
      imported,
      message: `Successfully synced ${imported} new transactions from Wave`,
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
