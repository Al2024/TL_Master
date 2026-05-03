import { ingestCV } from "../_lib/ingestionService.js";
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

function getField(fields: Record<string, string | string[]>, key: string) {
  const value = fields[key];
  return Array.isArray(value) ? value[0] : value;
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

    const { fields, file } = await parseMultipart(req);
    if (!file) {
      json(res, 400, { error: "No file uploaded" });
      return;
    }

    const employeeId = getField(fields, "employeeId") || "unknown";
    const original = file.originalFilename || "upload";

    await ingestCV(file.buffer, original, employeeId);
    json(res, 200, { success: true, message: "CV processed successfully" });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: error instanceof Error ? error.message : "Failed to process CV" });
  }
}
