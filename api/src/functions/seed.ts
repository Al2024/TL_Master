import { app } from "@azure/functions";
import { getDb } from "../_lib/db/index.js";

app.http("seed", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "seed",
  handler: async (_request, context) => {
    try {
      if (!process.env.DATABASE_URL) {
        return { status: 400, jsonBody: { error: "DATABASE_URL is not configured" } };
      }

      const db = getDb();
      void db; // placeholder for future seed logic

      return { jsonBody: { success: true } };
    } catch (error) {
      context.error(error);
      return { status: 500, jsonBody: { error: "Seeding failed" } };
    }
  },
});
