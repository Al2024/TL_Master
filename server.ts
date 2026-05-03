/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { getDb } from "./api/_lib/db/index";
import { assignments as assignmentsTable, weeklyAllocations, employees } from "./api/_lib/db/schema";
import { eq } from "drizzle-orm";

import multer from "multer";
import { ingestCSV, ingestCV } from "./api/_lib/ingestionService";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", db_connected: !!process.env.DATABASE_URL });
  });

  app.post("/api/upload/forecast", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      await ingestCSV(req.file.buffer);
      res.json({ success: true, message: "Forecast data ingested successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to ingest CSV" });
    }
  });

  app.post("/api/upload/cv", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const employeeId = req.body.employeeId || "unknown";
      await ingestCV(req.file.buffer, req.file.originalname, employeeId);
      res.json({ success: true, message: "CV processed successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to process CV" });
    }
  });

  app.get("/api/assignments", async (req, res) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.json({ mock: true, data: [] });
      }
      
      const db = getDb();
      const allAssignments = await db.query.assignments.findMany({
        with: {
            weeklyAllocations: true
        }
      });
      res.json({ data: allAssignments });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database query failed" });
    }
  });

  app.post("/api/seed", async (req, res) => {
    try {
      if (!process.env.DATABASE_URL) throw new Error("No DB URL");
      
      const db = getDb();
      // Basic seed logic placeholder
      // await db.insert(employees).values([...]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Seeding failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicitly handle SPA fallback in dev if middleware doesn't
    app.get("*", async (req, res, next) => {
      if (req.url.startsWith("/api")) return next();
      try {
        const fs = await import("fs");
        let template = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    // Production setup
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
