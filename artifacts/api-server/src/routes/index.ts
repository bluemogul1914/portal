import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transactionsRouter from "./transactions";
import budgetsRouter from "./budgets";
import taxesRouter from "./taxes";
import reportsRouter from "./reports";
import reconciliationRouter from "./reconciliation";
import openaiRouter from "./openai";
import integrationsRouter from "./integrations";
import vendorsRouter from "./vendors";
import n8nRouter from "./n8n";
import plaidRouter from "./plaid";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/transactions", transactionsRouter);
router.use("/budgets", budgetsRouter);
router.use("/taxes", taxesRouter);
router.use("/reports", reportsRouter);
router.use("/reconciliation", reconciliationRouter);
router.use("/openai", openaiRouter);
router.use(integrationsRouter);
router.use(vendorsRouter);
router.use(n8nRouter);
router.use(plaidRouter);

export default router;
