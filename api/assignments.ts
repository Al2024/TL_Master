import { getDb } from "../src/db/index";

function json(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export default async function handler(_req: any, res: any) {
  try {
    if (!process.env.DATABASE_URL) {
      json(res, 200, { mock: true, data: [] });
      return;
    }

    const db = getDb();
    const allAssignments = await db.query.assignments.findMany({
      with: { weeklyAllocations: true },
    });

    json(res, 200, { data: allAssignments });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Database query failed" });
  }
}
