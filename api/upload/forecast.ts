import { ingestCSV } from "../../src/services/ingestionService";
import { parseMultipart } from "../_multipart";

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
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    if (!process.env.DATABASE_URL) {
      json(res, 500, { error: "DATABASE_URL is not configured" });
      return;
    }

    const { file } = await parseMultipart(req);
    if (!file) {
      json(res, 400, { error: "No file uploaded" });
      return;
    }

    await ingestCSV(file.buffer);
    json(res, 200, { success: true, message: "Forecast data ingested successfully" });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: error instanceof Error ? error.message : "Failed to ingest CSV" });
  }
}
