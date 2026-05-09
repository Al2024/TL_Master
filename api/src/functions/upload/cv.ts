import { app } from "@azure/functions";
import { ingestCV } from "../../_lib/ingestionService.js";

app.http("upload-cv", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "upload/cv",
  handler: async (request, context) => {
    context.log("[upload/cv] request", {
      method: request.method,
      contentType: request.headers.get("content-type"),
    });

    try {
      const dbEnv = process.env.DATABASE_URL || process.env.TEAMLEADER_DATABASE_URL;
      if (!dbEnv) {
        context.error("[upload/cv] DATABASE_URL is not configured");
        return { status: 500, jsonBody: { error: "DATABASE_URL is not configured" } };
      }

      const formData = await request.formData();
      const fileEntry = formData.get("file");

      if (!fileEntry || typeof fileEntry === "string") {
        context.error("[upload/cv] no file received");
        return { status: 400, jsonBody: { error: "No file uploaded" } };
      }

      const file = fileEntry as File;
      const buffer = Buffer.from(await file.arrayBuffer());
      const original = file.name || "upload";
      const employeeId = (formData.get("employeeId") as string | null) || "unknown";

      context.log("[upload/cv] file received", { name: original, size: buffer.length });

      await ingestCV(buffer, original, employeeId);

      return { jsonBody: { success: true, message: "CV processed successfully" } };
    } catch (error) {
      context.error(error);
      return {
        status: 500,
        jsonBody: { error: error instanceof Error ? error.message : "Failed to process CV" },
      };
    }
  },
});
