# Deploying TL Master to Azure Static Web Apps

Everything is already in the `azure` branch on GitHub — you just need to create the Azure resource and point it at the repo. No code needs to be written on the work PC.

---

## Step 1 — Prerequisites on the Work PC

Install the following if not already present:

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Git** — [git-scm.com](https://git-scm.com)
- **Azure Functions Core Tools v4:**
  ```
  npm install -g azure-functions-core-tools@4 --unsafe-perm true
  ```
- **SWA CLI** (optional, for local testing):
  ```
  npm install -g @azure/static-web-apps-cli
  ```

---

## Step 2 — Create the Azure Static Web App

1. Go to [portal.azure.com](https://portal.azure.com) and sign in
2. Click **Create a resource** → search **Static Web App** → click **Create**
3. Fill in the **Basics** tab:

   | Field | Value |
   |---|---|
   | Subscription | Your subscription |
   | Resource Group | Create new → e.g. `tl-master-rg` |
   | Name | `tl-master` (or any name) |
   | Plan type | **Free** (sufficient) |
   | Region | Closest to you |
   | Source | **GitHub** |

4. Click **Sign in with GitHub** and authorise Azure
5. Set the repository fields:

   | Field | Value |
   |---|---|
   | Organization | Your GitHub org/username |
   | Repository | `TL_Master` |
   | Branch | **azure** |

6. Set the **Build Details**:

   | Field | Value |
   |---|---|
   | Build Preset | **Custom** |
   | App location | `/` |
   | Api location | `api` |
   | Output location | `dist` |

7. Click **Review + Create** → **Create**

---

## Step 3 — Add a Pre-Build Step for the API

Azure auto-generates a GitHub Actions workflow file and commits it to your `azure` branch. Once it appears (check GitHub → your repo → `.github/workflows/`), you need to edit it to build the Azure Functions TypeScript before deployment.

Open the workflow file (named something like `azure-static-web-apps-<hash>.yml`) and find the `jobs` section. Add a build step **before** the deploy action:

```yaml
- name: Build Azure Functions
  run: cd api && npm install && npm run build
```

It should sit just above the step that references `azure/static-web-apps-deploy@v1`. The full jobs block will look roughly like:

```yaml
jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Azure Functions
        run: cd api && npm install && npm run build

      - name: Deploy to Azure Static Web Apps
        uses: azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_... }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: "/"
          api_location: "api"
          output_location: "dist"
```

Commit and push that change to the `azure` branch.

---

## Step 4 — Set Environment Variables

In the Azure Portal, navigate to your new Static Web App:

1. Go to **Settings → Configuration** (left sidebar)
2. Under **Application settings**, click **Add** and add both:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Your Neon connection string |
   | `GEMINI_API_KEY` | Your Gemini API key |

3. Click **Save**

---

## Step 5 — Trigger a Deployment

Any push to the `azure` branch triggers a GitHub Actions deployment automatically. To trigger one immediately without a code change:

```bash
git clone https://github.com/Al2024/TL_Master
cd TL_Master
git checkout azure
git commit --allow-empty -m "chore: trigger azure deployment"
git push origin azure
```

---

## Step 6 — Monitor & Verify

1. Go to your repo on GitHub → **Actions** tab → watch the workflow run
2. Once it goes green, go back to the Azure Portal → your Static Web App → click the **URL** shown in the Overview panel
3. Verify:
   - The UI loads
   - Hit `<your-url>/api/health` → should return `{ "status": "ok", "db_connected": true }`
   - Upload a forecast CSV → confirm it ingests
   - Ask the AI chat a question → confirm Gemini responds

---

## Troubleshooting

| Problem | Fix |
|---|---|
| API returns 500 | Check env vars are set in Azure → Configuration → Application settings |
| `db_connected: false` | `DATABASE_URL` is missing or wrong; Neon connection strings must include `?sslmode=require` |
| GitHub Actions fails at `tsc` | Check that `api/tsconfig.json` is committed — it is on the `azure` branch |
| Functions not found (404 on `/api/*`) | Ensure `api_location: "api"` is set in the workflow and `api/host.json` exists |
| Gemini not responding | `GEMINI_API_KEY` env var missing in Azure Configuration |
