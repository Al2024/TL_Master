import { getDb } from "./_lib/db/index.js";

function json(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export default async function handler(_req: any, res: any) {
  try {
    if (!process.env.DATABASE_URL) {
      json(res, 400, { error: "DATABASE_URL is not configured" });
      return;
    }

    const db = getDb();
    void db; // placeholder for future seed logic

    json(res, 200, { success: true });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Seeding failed" });
  }
}
