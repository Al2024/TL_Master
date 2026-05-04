import { getSql } from "./_lib/db/index.js";

function json(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export default async function handler(_req: any, res: any) {
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

    json(res, 200, { columns, counts: counts[0] });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}
