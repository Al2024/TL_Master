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
  return "B";
}

function normalizeUpdateType(raw: string | undefined): string {
  if (!raw) return "forecast";
  const v = raw.trim().toUpperCase();
  if (v === "A" || v === "ACTUAL") return "actual";
  return "forecast";
}

/**
 * Normalise week column headers to a single canonical format: "YYYY DD-MMM"
 * Handles both:
 *   Old format: "2026 10-Apr"  → unchanged
 *   New format: "10-Apr-2026"  → "2026 10-Apr"
 */
function normalizeWeekKey(key: string): string | null {
  // Old format already canonical: "2026 10-Apr"
  if (/^\d{4} \d{2}-[A-Za-z]{3}$/.test(key)) return key;
  // New format: "10-Apr-2026"
  const m = key.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) return `${m[3]} ${m[1].padStart(2, '0')}-${m[2]}`;
  return null;
}

export async function ingestCSV(buffer: Buffer, batchId: number) {
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
    // ── Resolve employee ID + name ────────────────────────────────────────
    // New format: separate "Employee Number" and "Employee Name" columns
    // Old format: combined "Employee" = "Name : ID"
    let id: string | undefined;
    let name: string;

    const empNum = record["Employee Number"]?.trim();
    const empName = record["Employee Name"]?.trim();

    if (empNum) {
      // New format
      id = empNum;
      name = empName || "Unknown";
    } else {
      // Old format: "Name : ID"
      const employeeInfo = record["Employee"] || "";
      const parts = employeeInfo.split(" : ").map((s: string) => s.trim());
      id = parts[1]?.trim();
      name = parts[0]?.trim() || "Unknown";
    }

    if (!id) {
      console.warn("[ingestCSV] Skipping record with missing employee id", { empNum, empName });
      skipped++;
      continue;
    }

    // ── Resolve project number + name ─────────────────────────────────────
    // New format: "Project" = "IA243307 : Lightspeed AKL03 Design"
    // Old format: separate "ProjectNumber" and "ProjectName" columns
    let projectNumber: string | null;
    let projectName: string | null;

    const projectField = record["Project"]?.trim();
    if (projectField) {
      const pp = projectField.split(" : ").map((s: string) => s.trim());
      projectNumber = pp[0] || null;
      projectName = pp.slice(1).join(" : ") || null;
    } else {
      projectNumber = record["ProjectNumber"] || null;
      projectName = record["ProjectName"] || null;
    }

    try {
      await sql`
        INSERT INTO employees (id, employee_number, employee_name, name, grade, discipline, office, normal_weekly_hours)
        VALUES (
          ${id},
          ${id},
          ${name},
          ${name},
          ${record["Employee Grade"] || null},
          ${record["Discipline"] || null},
          ${record["Office"] || null},
          40
        )
        ON CONFLICT (id) DO UPDATE
          SET employee_name = EXCLUDED.employee_name,
              name          = EXCLUDED.name,
              grade         = EXCLUDED.grade,
              discipline    = EXCLUDED.discipline,
              office        = EXCLUDED.office
      `;

      const updateType  = normalizeUpdateType(record["Type"]);
      const projectType = normalizeProjectType(record["Project Type"]);
      const totalHours  = parseFloat(
        (record["Overall Total Project Hours"] || "0").replace(/,/g, "")
      );

      const [newAssignment] = await sql`
        INSERT INTO assignments (employee_id, project_number, project_name, project_type, project_manager, update_type, total_hours, batch_id)
        VALUES (
          ${id},
          ${projectNumber},
          ${projectName},
          ${projectType},
          ${record["Project Manager"] || null},
          ${updateType},
          ${isNaN(totalHours) ? 0 : totalHours},
          ${batchId}
        )
        RETURNING id
      `;

      const assignmentId = newAssignment.id;

      for (const [key, value] of Object.entries(record)) {
        const weekKey = normalizeWeekKey(key);
        if (!weekKey || !value) continue;
        const hours = parseFloat((value as string).replace(/,/g, ""));
        if (!isNaN(hours) && hours > 0) {
          await sql`
            INSERT INTO weekly_allocations (assignment_id, week, hours)
            VALUES (${assignmentId}, ${weekKey}, ${hours})
          `;
        }
      }

      inserted++;
    } catch (error) {
      failed++;
      console.error("[ingestCSV] Failed to ingest record", {
        employeeId: id,
        projectNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.info(`[ingestCSV] Done: inserted=${inserted} skipped=${skipped} failed=${failed}`);
  await sql`UPDATE upload_batches SET row_count = ${inserted} WHERE id = ${batchId}`;
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
