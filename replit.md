# Blue Mogul Enterprise - AI Bookkeeping Assistant

## Overview

Full-stack AI-powered bookkeeping application for Blue Mogul Enterprise, LLC. Built with React + Vite frontend, Express 5 backend, PostgreSQL database, and OpenAI GPT integration for an AI bookkeeping assistant named "Max".

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **AI**: OpenAI gpt-5.2 via Replit AI Integrations (no API key needed)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

1. **Dashboard** - KPI cards (monthly revenue, expenses, net income, YTD stats), recent transactions, upcoming tax deadlines
2. **Transactions** - Full CRUD, filtering by type/category/date/reconciled status, categorization
3. **Budgets** - Set budgets by category/month, view actuals vs budgeted with progress bars
4. **Cash Flow** - Monthly cash flow charts, category breakdowns
5. **Taxes** - Sales tax tracking, quarterly estimated taxes, deductions, year-end summary with P&L
6. **Bank Reconciliation** - Create reconciliation sessions, mark transactions as reconciled, track differences
7. **Reports** - P&L report, cash flow report with date range selection
8. **AI Assistant (Max)** - GPT-5.2 powered bookkeeping chat assistant with conversation history
9. **Integrations** - Wave Accounting API and Stripe Payments connection status and sync

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Replit AI proxy (auto-set)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Replit AI key (auto-set)

Optional (for integrations):
- `WAVE_API_KEY` - Wave Accounting API key for live sync
- `STRIPE_SECRET_KEY` - Stripe secret key for payment sync (use Stripe integration)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express 5 API server
│   │   └── src/routes/
│   │       ├── transactions.ts    # Transaction CRUD + reconcile
│   │       ├── budgets.ts         # Budget management + summary
│   │       ├── taxes.ts           # Tax items + year-end summary
│   │       ├── reports.ts         # Dashboard, cashflow, P&L
│   │       ├── reconciliation.ts  # Bank reconciliation sessions
│   │       ├── openai.ts          # AI chat (Max) endpoints
│   │       └── integrations.ts    # Wave + Stripe sync
│   └── bookkeeper/         # React + Vite frontend
│       └── src/
│           ├── pages/             # Dashboard, Transactions, Budgets, Taxes, Reports, Chat, Integrations, Reconciliation
│           ├── components/        # Layout, TransactionForm, shared UI
│           └── hooks/             # Custom hooks for each API domain
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   │   └── src/schema/
│   │       ├── transactions.ts
│   │       ├── budgets.ts
│   │       ├── taxes.ts
│   │       ├── reconciliation.ts
│   │       ├── conversations.ts   # AI chat conversations
│   │       └── messages.ts        # AI chat messages
│   ├── integrations-openai-ai-server/  # OpenAI server SDK wrapper
│   └── integrations-openai-ai-react/   # OpenAI React hooks
└── scripts/
```

## Wave Accounting Integration

The Wave integration uses the Wave GraphQL API (https://developer.waveapps.com/hc/en-us/articles/360019968212-API-Reference).
Add `WAVE_API_KEY` environment variable with a Wave API token to enable live sync.

## Stripe Integration

Uses Stripe's charges API to import successful payments. Connect via Replit Stripe integration or add `STRIPE_SECRET_KEY`.

## Development

```bash
pnpm install
pnpm --filter @workspace/db run push  # Push DB schema
# Start API server (port 8080) and Vite dev server (port 23932) via workflows
```

## Codegen

After OpenAPI spec changes:
```bash
pnpm --filter @workspace/api-spec run codegen
```
