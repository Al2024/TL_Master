function json(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export default function handler(_req: any, res: any) {
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasTeamleaderUrl = !!process.env.TEAMLEADER_DATABASE_URL;
  json(res, 200, {
    status: "ok",
    db_connected: hasDatabaseUrl || hasTeamleaderUrl,
    env: {
      DATABASE_URL: hasDatabaseUrl,
      TEAMLEADER_DATABASE_URL: hasTeamleaderUrl,
    },
  });
}
