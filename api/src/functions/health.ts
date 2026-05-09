import { app } from "@azure/functions";

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: async (_request, _context) => {
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    const hasTeamleaderUrl = !!process.env.TEAMLEADER_DATABASE_URL;
    return {
      jsonBody: {
        status: "ok",
        db_connected: hasDatabaseUrl || hasTeamleaderUrl,
        env: {
          DATABASE_URL: hasDatabaseUrl,
          TEAMLEADER_DATABASE_URL: hasTeamleaderUrl,
        },
      },
    };
  },
});
