import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db/schema";

const router: IRouter = Router();

const WAVE_API_URL = "https://gql.waveapps.com/graphql/public";

router.get("/wave/status", async (_req, res) => {
  const apiKey = process.env.WAVE_API_KEY;
  res.json({
    connected: !!apiKey,
    lastSynced: null,
    message: apiKey ? "Wave Accounting connected" : "Wave API key not configured. Add WAVE_API_KEY to environment variables.",
  });
});

router.post("/wave/sync", async (_req, res) => {
  const apiKey = process.env.WAVE_API_KEY;
  if (!apiKey) {
    return res.json({
      success: false,
      imported: 0,
      message: "Wave API key not configured. Please add WAVE_API_KEY to your environment variables and connect your Wave account.",
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
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return res.json({ success: false, imported: 0, message: `Wave API error: ${response.statusText}` });
    }

    const data = await response.json() as any;
    const businesses = data?.data?.businesses?.edges || [];
    let imported = 0;

    for (const biz of businesses) {
      const txns = biz.node?.transactions?.edges || [];
      for (const edge of txns) {
        const tx = edge.node;
        const existing = await db.select().from(transactionsTable)
          .where(require("drizzle-orm").eq(transactionsTable.sourceId, tx.id)).limit(1);
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

    res.json({ success: true, imported, message: `Successfully synced ${imported} new transactions from Wave` });
  } catch (e) {
    console.error(e);
    res.json({ success: false, imported: 0, message: "Failed to sync Wave data" });
  }
});

router.get("/stripe/status", async (_req, res) => {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  res.json({
    connected: !!apiKey,
    lastSynced: null,
    message: apiKey ? "Stripe connected" : "Stripe not connected. Please connect your Stripe account.",
  });
});

router.post("/stripe/sync", async (_req, res) => {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    return res.json({
      success: false,
      imported: 0,
      message: "Stripe not connected. Please connect your Stripe account through the integrations panel.",
    });
  }

  try {
    const { eq } = await import("drizzle-orm");

    const response = await fetch("https://api.stripe.com/v1/charges?limit=50", {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return res.json({ success: false, imported: 0, message: `Stripe API error: ${response.statusText}` });
    }

    const data = await response.json() as any;
    const charges = data.data || [];
    let imported = 0;

    for (const charge of charges) {
      if (charge.status !== "succeeded") continue;
      const existing = await db.select().from(transactionsTable)
        .where(eq(transactionsTable.sourceId, charge.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(transactionsTable).values({
          date: new Date(charge.created * 1000).toISOString().split("T")[0],
          description: charge.description || `Stripe payment from ${charge.billing_details?.name || "customer"}`,
          amount: String(charge.amount / 100),
          type: "income",
          category: "Stripe Revenue",
          source: "stripe",
          sourceId: charge.id,
          taxDeductible: false,
        });
        imported++;
      }
    }

    res.json({ success: true, imported, message: `Successfully imported ${imported} new payments from Stripe` });
  } catch (e) {
    console.error(e);
    res.json({ success: false, imported: 0, message: "Failed to sync Stripe data" });
  }
});

export default router;
