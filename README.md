<div align="center">
<img width="1200" height="475" alt="TL Master Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TL Master — Intelligence Edition

A resource management and workforce intelligence platform for technical leads and project managers. Upload forecast data, monitor utilisation and burnout risk across your team, model PM bias, and ask plain-language questions about your workforce via an AI chat assistant.

**v1.0.0** — fully functioning release tagged on `main`.  
**`azure` branch** — in-progress conversion to Azure Static Web Apps (see [Deployment](#deployment)).

---

## Features

- **Dashboard** — KPI cards for headcount, billability %, burnout alerts, and bench risk
- **Forecast ingestion** — upload CSV snapshots exported from resource planning tools; each upload creates a versioned batch
- **Weekly allocation heatmap** — per-employee grid showing forecast vs actual hours across a rolling window
- **PM bias modelling** — calculates each project manager's historical forecast accuracy coefficient
- **Predictive analytics** — burnout detection (>42 h/week), bench risk detection (<8 h/week), billability trends
- **Win probability slider** — scales proposal hours to model the impact of a project win/loss on overall utilisation
- **AI Strategic Architect** — natural-language chat powered by Gemini; answers questions about individual staff, projects, and risks using live data
- **CV upload** — attach staff CVs (PDF/DOCX) to employee records for skill indexing
- **Multi-batch comparison** — switch between historical snapshots to compare periods

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Charts | Recharts |
| Animation | Motion (Framer Motion) |
| Components | shadcn/ui (Radix primitives) |
| API (Vercel) | Vercel Serverless Functions (TypeScript) |
| API (Azure) | Azure Functions v4 (TypeScript) |
| ORM | Drizzle ORM |
| Database | Neon (serverless Postgres) |
| AI | Google Gemini (`gemini-2.0-flash`) via `@google/genai` |
| Local dev server | Express + Vite middleware (`server.ts`) |

---

## Database Schema

Five tables managed by Drizzle ORM and provisioned automatically on first request:

| Table | Purpose |
|---|---|
| `employees` | Staff records — name, grade, discipline, office, weekly hours |
| `assignments` | One row per employee × project combination per batch |
| `weekly_allocations` | Hour values per week per assignment |
| `upload_batches` | Metadata for each CSV upload (label, filename, row count, timestamp) |
| `pm_performance` | PM forecast accuracy ratings |

---

## Project Structure

```
├── src/
│   ├── App.tsx                  # Main React application
│   ├── types.ts                 # Shared TypeScript types
│   ├── services/
│   │   ├── dataService.ts       # Fetch helpers (assignments, batches, uploads)
│   │   └── geminiService.ts     # Gemini AI chat integration
│   └── lib/
│       └── predictive.ts        # Billability, burnout, bench risk calculations
├── api/                         # Vercel serverless handlers (production on main)
│   ├── assignments.ts
│   ├── batches.ts
│   ├── health.ts
│   ├── seed.ts
│   ├── upload/
│   │   ├── forecast.ts
│   │   └── cv.ts
│   └── _lib/
│       ├── ingestionService.ts  # CSV parsing and DB writes
│       └── db/
│           ├── index.ts         # Neon connection + schema bootstrap
│           └── schema.ts        # Drizzle table definitions
├── components/ui/               # shadcn/ui component overrides
├── server.ts                    # Express dev server (local only)
├── vite.config.ts
├── staticwebapp.config.json     # Azure Static Web Apps routing config
└── vercel.json                  # Vercel SPA rewrite rules
```

---

## Getting Started (Local)

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) database (free tier is sufficient)
- A [Google AI Studio](https://aistudio.google.com) API key

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

```env
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
GEMINI_API_KEY=your_gemini_api_key
```

The schema is created automatically on first API call — no migrations to run manually.

### 3. Run

```bash
npm run dev
```

Opens the app at `http://localhost:3000`. The Express server in `server.ts` serves both the Vite dev frontend and the `/api/*` routes.

---

## Uploading Data

### Forecast CSV

Click the upload icon in the header and select a CSV file exported from your resource planning tool. The expected format includes columns for Employee, Project, weekly hour columns (e.g. `2026 02-Jan`), and metadata fields such as `UpdateType` (forecast/actual), `Project Type` (B/P/N), and `Employee Grade`.

Each upload creates a new batch. Use the **Data Snapshot** dropdown in the header to switch between batches.

### CVs

Upload staff CVs (PDF or DOCX) via the upload panel. Each CV is linked to an employee record by ID.

---

## AI Chat

The **Strategic Architect** panel (bottom-right) accepts plain-language questions about your workforce. Examples:

- *"Who is at burnout risk this week?"*
- *"Which project uses the most staff?"*
- *"What is Sarah's current billability?"*
- *"Which PM has the highest bias coefficient?"*

The AI receives live per-employee data — names, grades, disciplines, project allocations, risk flags, and billability percentages — so it can answer individual-level questions.

---

## Deployment

### Vercel (current production — `main` branch)

1. Import the repo into [Vercel](https://vercel.com)
2. Set environment variables in Project Settings:
   - `DATABASE_URL`
   - `GEMINI_API_KEY`
3. Vercel runs `npm run build` and serves `dist/`. API routes are automatically detected from the `api/` folder.

### Azure Static Web Apps (`azure` branch — in progress)

The `azure` branch contains a full conversion to Azure SWA + Azure Functions v4. The Vercel handlers in `api/` have been restructured to `api/src/functions/` using the `@azure/functions` v4 programming model.

**To deploy:**

1. Install tooling:
   ```bash
   npm install -g azure-functions-core-tools@4 @azure/static-web-apps-cli
   ```
2. In Azure Portal, create a Static Web App linked to the `azure` branch:
   - App location: `/`
   - Api location: `api`
   - Output location: `dist`
3. Add `DATABASE_URL` and `GEMINI_API_KEY` in Azure SWA → Configuration → Application Settings
4. Azure auto-generates a GitHub Actions workflow that builds and deploys on push

**Local SWA dev:**

```bash
# Build the frontend
npm run build

# Build the Azure Functions
cd api && npm install && npm run build && cd ..

# Start the full stack locally (frontend + functions) on port 4280
npm run swa
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon (or any Postgres) connection string |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |

If `DATABASE_URL` is not set, the API returns empty mock data and the app runs in demo mode.

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Express dev server with Vite HMR |
| `npm run build` | Build frontend to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | TypeScript type check |
| `npm run swa` | Run full stack locally via SWA CLI (requires prior build) |

---

## License

Apache-2.0
