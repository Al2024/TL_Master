<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b48a1415-5309-48cc-a240-9811ac2eec05

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy on Vercel

This app is configured for Vercel with serverless API routes in the `api/` folder.

1. Push this repo to GitHub and import it into Vercel.
2. In Vercel Project Settings → Environment Variables, set:
   - `GEMINI_API_KEY`
   - `DATABASE_URL` (optional; leave unset to use mock data)
3. Deploy. Vercel will run `npm run build` and serve the `dist/` output.

### Notes

- API routes live under `/api/*` (for example, `/api/assignments`).
- File uploads use multipart form data and are handled in Vercel Functions.
