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
      json(res, 200, { mock: true, data: [] });
      return;
    }

    await ensureSchema();
    const sql = getSql();

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
      GROUP BY a.id, e.employee_name, e.grade, e.discipline, e.office
      ORDER BY a.id
    `;

    console.info(`[assignments] returning ${allAssignments.length} rows`);

    json(res, 200, { data: allAssignments });
  } catch (error) {
    console.error("[assignments] query failed:", error instanceof Error ? error.message : String(error));
    json(res, 500, { error: error instanceof Error ? error.message : "Database query failed" });
  }
}
