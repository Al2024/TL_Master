import { ingestCSV } from "../_lib/ingestionService.js";
import { ensureSchema, getSql } from "../_lib/db/index.js";
import { parseMultipart } from "../_multipart.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function json(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export default async function handler(req: any, res: any) {
  console.info("[upload/forecast] request", {
    method: req.method,
    contentType: req.headers?.["content-type"],
  });

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const dbEnv = process.env.DATABASE_URL || process.env.TEAMLEADER_DATABASE_URL;
    if (!dbEnv) {
      console.error("[upload/forecast] DATABASE_URL is not configured");
      json(res, 500, { error: "DATABASE_URL is not configured" });
      return;
    }

    const { file } = await parseMultipart(req);
    if (!file) {
      console.error("[upload/forecast] no file received");
      json(res, 400, { error: "No file uploaded" });
      return;
    }

    console.info("[upload/forecast] file received", {
      name: file.originalFilename,
      size: file.buffer?.length,
    });

    await ensureSchema();
    const sql = getSql();
    const filename = file.originalFilename || 'forecast.csv';
    const label = `${filename} — ${new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}`;

    // Create batch record before ingestion
    const [batch] = await sql`
      INSERT INTO upload_batches (label, filename) VALUES (${label}, ${filename}) RETURNING id
    `;

    await ingestCSV(file.buffer, batch.id);
    json(res, 200, { success: true, message: "Forecast data ingested successfully", batchId: batch.id, label });
  } catch (error) {
    console.error(error);
    json(res, 500, {
      error: error instanceof Error ? error.message : "Failed to ingest CSV",
    });
  }
}
