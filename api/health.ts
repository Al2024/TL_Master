function json(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export default function handler(_req: any, res: any) {
  json(res, 200, { status: "ok", db_connected: !!process.env.DATABASE_URL });
}
