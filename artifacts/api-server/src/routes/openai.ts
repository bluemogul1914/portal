import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations as conversationsTable, messages as messagesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are Max, a professional AI bookkeeping assistant for Blue Mogul Enterprise, LLC. 
You are an expert in:
- Cash flow analysis and management
- Expense categorization and tracking
- Budget planning and variance analysis
- Tax preparation including sales tax collection, quarterly estimated taxes, and year-end business taxes
- Bank reconciliation processes
- Financial reporting (P&L, balance sheets, cash flow statements)
- Wave Accounting and Stripe Payments integration

When answering questions:
- Be specific and actionable
- Reference accounting best practices
- Use clear financial terminology while remaining accessible
- Ask clarifying questions when needed
- Format numbers clearly with dollar signs and commas
- Provide step-by-step guidance for complex tasks

You help Blue Mogul Enterprise, LLC maintain accurate financial records and stay compliant with tax obligations.`;

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

    const history = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(messagesTable.createdAt);

    const chatMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
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
