import { app } from "@azure/functions";
import { ingestCSV } from "../../_lib/ingestionService.js";
import { ensureSchema, getSql } from "../../_lib/db/index.js";

app.http("upload-forecast", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "upload/forecast",
  handler: async (request, context) => {
    context.log("[upload/forecast] request", {
      method: request.method,
      contentType: request.headers.get("content-type"),
    });

    try {
      const dbEnv = process.env.DATABASE_URL || process.env.TEAMLEADER_DATABASE_URL;
      if (!dbEnv) {
        context.error("[upload/forecast] DATABASE_URL is not configured");
        return { status: 500, jsonBody: { error: "DATABASE_URL is not configured" } };
      }

      const formData = await request.formData();
      const fileEntry = formData.get("file");

      if (!fileEntry || typeof fileEntry === "string") {
        context.error("[upload/forecast] no file received");
        return { status: 400, jsonBody: { error: "No file uploaded" } };
      }

      const file = fileEntry as File;
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = file.name || "forecast.csv";

      context.log("[upload/forecast] file received", { name: filename, size: buffer.length });

      await ensureSchema();
      const sql = getSql();
      const label = `${filename} — ${new Date().toLocaleString("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
      })}`;

      const [batch] = await sql`
        INSERT INTO upload_batches (label, filename) VALUES (${label}, ${filename}) RETURNING id
      `;

      await ingestCSV(buffer, batch.id);

      return {
        jsonBody: {
          success: true,
          message: "Forecast data ingested successfully",
          batchId: batch.id,
          label,
        },
      };
    } catch (error) {
      context.error(error);
      return {
        status: 500,
        jsonBody: { error: error instanceof Error ? error.message : "Failed to ingest CSV" },
      };
    }
  },
});
