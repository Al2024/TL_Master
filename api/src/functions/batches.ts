import { app } from "@azure/functions";
import { ensureSchema, getSql } from "../_lib/db/index.js";

app.http("batches", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "batches",
  handler: async (_request, context) => {
    try {
      const dbEnv = process.env.DATABASE_URL || process.env.TEAMLEADER_DATABASE_URL;
      if (!dbEnv) {
        return { jsonBody: { data: [] } };
      }

      await ensureSchema();
      const sql = getSql();

      const batches = await sql`
        SELECT id, label, filename, uploaded_at, row_count
        FROM upload_batches
        ORDER BY uploaded_at DESC
      `;

      return { jsonBody: { data: batches } };
    } catch (error) {
      context.error("[batches] query failed:", error instanceof Error ? error.message : String(error));
      return {
        status: 500,
        jsonBody: { error: error instanceof Error ? error.message : "Failed to fetch batches" },
      };
    }
  },
});
