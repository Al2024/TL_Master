import { app } from "@azure/functions";
import { ensureSchema, getSql } from "../_lib/db/index.js";

app.http("assignments", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "assignments",
  handler: async (request, context) => {
    try {
      const dbEnv = process.env.DATABASE_URL || process.env.TEAMLEADER_DATABASE_URL;
      if (!dbEnv) {
        return { jsonBody: { mock: true, data: [] } };
      }

      await ensureSchema();
      const sql = getSql();

      const queryBatchId = request.query.get("batch_id")
        ? parseInt(request.query.get("batch_id") as string)
        : null;
      let batchId: number | null = queryBatchId;

      if (!batchId) {
        const [latest] = await sql`SELECT id FROM upload_batches ORDER BY uploaded_at DESC LIMIT 1`;
        batchId = latest?.id ?? null;
      }

      if (!batchId) {
        return { jsonBody: { data: [], batchId: null } };
      }

      const allAssignments = await sql`
        SELECT
          a.id,
          a.employee_id,
          a.project_number,
          a.project_name,
          a.project_type,
          a.project_manager,
          a.update_type,
          a.total_hours,
          a.created_at,
          a.batch_id,
          e.employee_name,
          e.grade,
          e.discipline,
          e.office,
          COALESCE(
            json_agg(
              json_build_object('id', w.id, 'week', w.week, 'hours', w.hours)
            ) FILTER (WHERE w.id IS NOT NULL),
            '[]'::json
          ) as weekly_allocations
        FROM assignments a
        LEFT JOIN employees e ON e.id = a.employee_id
        LEFT JOIN weekly_allocations w ON w.assignment_id = a.id
        WHERE a.batch_id = ${batchId}
        GROUP BY a.id, e.employee_name, e.grade, e.discipline, e.office
        ORDER BY a.id
      `;

      context.log(`[assignments] batch=${batchId} returning ${allAssignments.length} rows`);

      return { jsonBody: { data: allAssignments, batchId } };
    } catch (error) {
      context.error("[assignments] query failed:", error instanceof Error ? error.message : String(error));
      return {
        status: 500,
        jsonBody: { error: error instanceof Error ? error.message : "Database query failed" },
      };
    }
  },
});
