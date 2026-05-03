/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { parse } from "csv-parse/sync";
import mammoth from "mammoth";
import { ensureSchema, getSql } from "./db/index.js";

function normalizeProjectType(raw: string | undefined): string {
  if (!raw) return "B";
  const val = raw.trim().toUpperCase();
  if (val === "B" || val === "BILLABLE") return "B";
  if (val === "P" || val === "PROPOSAL") return "P";
  if (val === "N" || val === "NON-BILLABLE" || val === "NON_BILLABLE") return "N";
  // Default to B — store at most 1 char to satisfy varchar(1)
  return "B";
}

export async function ingestCSV(buffer: Buffer) {
  await ensureSchema();
  const sql = getSql();
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of records) {
    const employeeInfo = record["Employee"] || "";
    const parts = employeeInfo.split(" : ").map((s: string) => s.trim());
    // Format can be "Name : ID" or just missing
    const id = parts[1]?.trim();
    const name = parts[0]?.trim() || "Unknown";

    if (!id) {
      console.warn("[ingestCSV] Skipping record with missing employee id", { employeeInfo });
      skipped++;
      continue;
    }

    try {
      // Raw SQL insert — immune to Drizzle column resolution issues
      await sql`
        INSERT INTO employees (id, name, grade, discipline, office, normal_weekly_hours)
        VALUES (
          ${id},
          ${name},
          ${record["Employee Grade"] || null},
          ${record["Discipline"] || null},
          ${record["Office"] || null},
          40
        )
        ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name,
              grade = EXCLUDED.grade
      `;

      const typeStr = record["Type"]?.toLowerCase();
      const updateType = typeStr === "actual" ? "actual" : "forecast";
      const projectType = normalizeProjectType(record["Project Type"]);
      const totalHours = parseFloat(record["Overall Total Project Hours"]?.replace(/,/g, "") || "0");

      const [newAssignment] = await sql`
        INSERT INTO assignments (employee_id, project_number, project_name, project_type, project_manager, update_type, total_hours)
        VALUES (
          ${id},
          ${record["ProjectNumber"] || null},
          ${record["ProjectName"] || null},
          ${projectType},
          ${record["Project Manager"] || null},
          ${updateType},
          ${isNaN(totalHours) ? 0 : totalHours}
        )
        RETURNING id
      `;

      const assignmentId = newAssignment.id;
      const weekRegex = /^\d{4} \d{2}-[A-Za-z]{3}$/;
      for (const [key, value] of Object.entries(record)) {
        if (weekRegex.test(key) && value) {
          const hours = parseFloat((value as string).replace(/,/g, ""));
          if (!isNaN(hours) && hours > 0) {
            await sql`
              INSERT INTO weekly_allocations (assignment_id, week, hours)
              VALUES (${assignmentId}, ${key}, ${hours})
            `;
          }
        }
      }

      inserted++;
    } catch (error) {
      failed++;
      console.error("[ingestCSV] Failed to ingest record", {
        employeeId: id,
        projectNumber: record["ProjectNumber"],
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue processing remaining records
    }
  }

  console.info(`[ingestCSV] Done: inserted=${inserted} skipped=${skipped} failed=${failed}`);
}

export async function ingestCV(buffer: Buffer, originalname: string, employeeId: string) {
  await ensureSchema();
  const sql = getSql();
  let text = "";

  if (originalname.endsWith(".pdf")) {
    const pdfImport = await import("pdf-parse");
    const pdf = (pdfImport as any).default || pdfImport;
    const data = await pdf(buffer);
    text = data.text;
  } else if (originalname.endsWith(".docx") || originalname.endsWith(".doc")) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  }

  if (text) {
    await sql`
      INSERT INTO skill_vectors (employee_id, bio, embedding)
      VALUES (${employeeId}, ${text}, ARRAY[0.1, 0.2, 0.3])
    `;
  }
}
