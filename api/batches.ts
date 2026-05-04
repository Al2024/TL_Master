import { ensureSchema, getSql } from "./_lib/db/index.js";

function json(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export default async function handler(_req: any, res: any) {
  try {
    const dbEnv = process.env.DATABASE_URL || process.env.TEAMLEADER_DATABASE_URL;
    if (!dbEnv) {
      json(res, 200, { data: [] });
      return;
    }

    await ensureSchema();
    const sql = getSql();

    const batches = await sql`
      SELECT id, label, filename, uploaded_at, row_count
      FROM upload_batches
      ORDER BY uploaded_at DESC
    `;

    json(res, 200, { data: batches });
  } catch (error) {
    console.error("[batches] query failed:", error instanceof Error ? error.message : String(error));
    json(res, 500, { error: error instanceof Error ? error.message : "Failed to fetch batches" });
  }
}
