import { app } from "@azure/functions";
import { getSql } from "../_lib/db/index.js";

app.http("debug-schema", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "debug-schema",
  handler: async (_request, context) => {
    try {
      const sql = getSql();

      const columns = await sql`
        SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('employees', 'assignments', 'weekly_allocations')
        ORDER BY table_name, ordinal_position
      `;

      const counts = await sql`
        SELECT
          (SELECT COUNT(*) FROM employees) as employee_count,
          (SELECT COUNT(*) FROM assignments) as assignment_count,
          (SELECT COUNT(*) FROM weekly_allocations) as allocation_count
      `;

      return { jsonBody: { columns, counts: counts[0] } };
    } catch (error) {
      context.error(error);
      return {
        status: 500,
        jsonBody: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  },
});
