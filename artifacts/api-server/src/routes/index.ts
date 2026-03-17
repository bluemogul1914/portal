import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transactionsRouter from "./transactions";
import budgetsRouter from "./budgets";
import taxesRouter from "./taxes";
import reportsRouter from "./reports";
import reconciliationRouter from "./reconciliation";
import openaiRouter from "./openai";
import integrationsRouter from "./integrations";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/transactions", transactionsRouter);
router.use("/budgets", budgetsRouter);
router.use("/taxes", taxesRouter);
router.use("/reports", reportsRouter);
router.use("/reconciliation", reconciliationRouter);
router.use("/openai", openaiRouter);
router.use(integrationsRouter);

export default router;
