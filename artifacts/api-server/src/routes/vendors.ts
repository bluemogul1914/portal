import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { vendorsTable } from "@workspace/db/schema";
import { eq, like, or, desc } from "drizzle-orm";

const router: IRouter = Router();
const WAVE_API_URL = "https://gql.waveapps.com/graphql/public";
const BIZ_ID = "QnVzaW5lc3M6ZmI1M2YxMjgtYTg5ZC00MjBhLWJhOWMtNGRjZTVmNDhhNjI2";

// ── LIST vendors ──────────────────────────────────────────────────────────────
router.get("/vendors", async (req, res) => {
  try {
    const { search } = req.query as { search?: string };
    const rows = search
      ? await db.select().from(vendorsTable)
          .where(or(
            like(vendorsTable.name, `%${search}%`),
            like(vendorsTable.email, `%${search}%`),
          ))
          .orderBy(desc(vendorsTable.createdAt))
      : await db.select().from(vendorsTable).orderBy(desc(vendorsTable.createdAt));
    res.json(rows);
  } catch (e) {
    console.error("List vendors error:", e);
    res.status(500).json({ error: "Failed to list vendors" });
  }
});

// ── GET single vendor ─────────────────────────────────────────────────────────
router.get("/vendors/:id", async (req, res) => {
  try {
    const [row] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Vendor not found" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to get vendor" });
  }
});

// ── CREATE vendor ─────────────────────────────────────────────────────────────
router.post("/vendors", async (req, res) => {
  try {
    const { name, email, phone, mobile, website, addressLine1, addressLine2, city, province, country, postalCode, currency, notes } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const [row] = await db.insert(vendorsTable).values({
      name, email, phone, mobile, website, addressLine1, addressLine2, city, province, country, postalCode,
      currency: currency || "USD", notes, source: "manual",
    }).returning();
    res.json(row);
  } catch (e) {
    console.error("Create vendor error:", e);
    res.status(500).json({ error: "Failed to create vendor" });
  }
});

// ── UPDATE vendor ─────────────────────────────────────────────────────────────
router.put("/vendors/:id", async (req, res) => {
  try {
    const { name, email, phone, mobile, website, addressLine1, addressLine2, city, province, country, postalCode, currency, notes } = req.body;
    const [row] = await db.update(vendorsTable)
      .set({ name, email, phone, mobile, website, addressLine1, addressLine2, city, province, country, postalCode, currency, notes, updatedAt: new Date() })
      .where(eq(vendorsTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Vendor not found" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to update vendor" });
  }
});

// ── DELETE vendor ─────────────────────────────────────────────────────────────
router.delete("/vendors/:id", async (req, res) => {
  try {
    await db.delete(vendorsTable).where(eq(vendorsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete vendor" });
  }
});

// ── WAVE VENDOR SYNC ──────────────────────────────────────────────────────────
router.post("/wave/vendors/sync", async (_req, res) => {
  const apiKey = process.env.WAVE_API_KEY;
  if (!apiKey) return res.json({ success: false, imported: 0, message: "Wave API key not configured" });

  try {
    let page = 1;
    let hasMore = true;
    let imported = 0;
    let updated = 0;

    while (hasMore) {
      const resp = await fetch(WAVE_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `{
            business(id: "${BIZ_ID}") {
              vendors(page: ${page}, pageSize: 50) {
                pageInfo { totalCount currentPage totalPages }
                edges {
                  node {
                    id name displayId email mobile phone website currency { code }
                    address { addressLine1 addressLine2 city province { name } country { name } postalCode }
                  }
                }
              }
            }
          }`,
        }),
      });

      const data = await resp.json() as any;
      const vendorsPage = data?.data?.business?.vendors;
      if (!vendorsPage) break;

      const { totalPages, currentPage } = vendorsPage.pageInfo;
      const edges: any[] = vendorsPage.edges || [];

      for (const edge of edges) {
        const v = edge.node;
        const sourceId = `wave-vendor-${v.id}`;

        const existing = await db.select().from(vendorsTable).where(eq(vendorsTable.sourceId, sourceId)).limit(1);

        const payload = {
          name: v.name,
          email: v.email || null,
          phone: v.phone || null,
          mobile: v.mobile || null,
          website: v.website || null,
          displayId: v.displayId || null,
          addressLine1: v.address?.addressLine1 || null,
          addressLine2: v.address?.addressLine2 || null,
          city: v.address?.city || null,
          province: v.address?.province?.name || null,
          country: v.address?.country?.name || null,
          postalCode: v.address?.postalCode || null,
          currency: v.currency?.code || "USD",
          source: "wave" as const,
          sourceId,
          updatedAt: new Date(),
        };

        if (existing.length === 0) {
          await db.insert(vendorsTable).values(payload);
          imported++;
        } else {
          await db.update(vendorsTable).set(payload).where(eq(vendorsTable.sourceId, sourceId));
          updated++;
        }
      }

      hasMore = currentPage < totalPages;
      page++;
    }

    res.json({
      success: true,
      imported,
      updated,
      message: imported > 0 || updated > 0
        ? `Synced ${imported} new and ${updated} updated vendors from Wave`
        : "All Wave vendors are already up to date",
    });
  } catch (e) {
    console.error("Wave vendor sync error:", e);
    res.json({ success: false, imported: 0, message: "Failed to sync vendors from Wave" });
  }
});

export default router;
