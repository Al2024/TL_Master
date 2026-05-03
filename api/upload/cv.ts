import { ingestCV } from "../../src/services/ingestionService";
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
    json(res, 500, { error: "Failed to process CV" });
  }
}
