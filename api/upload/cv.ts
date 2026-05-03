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
  console.info("[upload/cv] request", {
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
      console.error("[upload/cv] DATABASE_URL is not configured");
      json(res, 500, { error: "DATABASE_URL is not configured" });
      return;
    }

    const { fields, file } = await parseMultipart(req);
    if (!file) {
      console.error("[upload/cv] no file received");
      json(res, 400, { error: "No file uploaded" });
      return;
    }

    console.info("[upload/cv] file received", {
      name: file.originalFilename,
      size: file.buffer?.length,
    });

    const employeeId = getField(fields, "employeeId") || "unknown";
    const original = file.originalFilename || "upload";

    await ingestCV(file.buffer, original, employeeId);
    json(res, 200, { success: true, message: "CV processed successfully" });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: error instanceof Error ? error.message : "Failed to process CV" });
  }
}
