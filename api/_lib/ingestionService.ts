/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { parse } from "csv-parse/sync";
import * as pdfImport from "pdf-parse";
const pdf = (pdfImport as any).default || pdfImport;
import mammoth from "mammoth";
import { getDb } from "./db/index";
import { assignments, weeklyAllocations, employees, skillVectors } from "./db/schema";

const ProjectType = {
  BILLABLE: "B",
  PROPOSAL: "P",
  NON_BILLABLE: "N",
} as const;

type ProjectTypeValue = (typeof ProjectType)[keyof typeof ProjectType];

type UpdateTypeValue = "actual" | "forecast";

export async function ingestCSV(buffer: Buffer) {
  const db = getDb();
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  for (const record of records) {
    const employeeInfo = record["Employee"] || "";
    const [name, id] = employeeInfo.split(" : ").map((s: string) => s.trim());

    if (!id) continue;

    await db
      .insert(employees)
      .values({
        id: id,
        name: name || "Unknown",
        grade: record["Employee Grade"],
        discipline: record["Discipline"],
        office: record["Office"],
      })
      .onConflictDoUpdate({
        target: employees.id,
        set: { name, grade: record["Employee Grade"] },
      });

    const typeStr = record["Type"]?.toLowerCase();
    const updateType: UpdateTypeValue = typeStr === "actual" ? "actual" : "forecast";

    const projectType = (record["Project Type"] as ProjectTypeValue) || ProjectType.BILLABLE;

    const [newAssignment] = await db
      .insert(assignments)
      .values({
        employeeId: id,
        projectNumber: record["ProjectNumber"],
        projectName: record["ProjectName"],
        projectType: projectType,
        projectManager: record["Project Manager"],
        updateType: updateType,
        totalHours: parseFloat(record["Overall Total Project Hours"]?.replace(/,/g, "") || "0"),
      })
      .returning();

    const weekRegex = /^\d{4} \d{2}-[A-Za-z]{3}$/;
    for (const [key, value] of Object.entries(record)) {
      if (weekRegex.test(key) && value) {
        const hours = parseFloat((value as string).replace(/,/g, ""));
        if (!isNaN(hours) && hours > 0) {
          await db.insert(weeklyAllocations).values({
            assignmentId: newAssignment.id,
            week: key,
            hours: hours,
          });
        }
      }
    }
  }
}

export async function ingestCV(buffer: Buffer, originalname: string, employeeId: string) {
  const db = getDb();
  let text = "";

  if (originalname.endsWith(".pdf")) {
    const data = await pdf(buffer);
    text = data.text;
  } else if (originalname.endsWith(".docx") || originalname.endsWith(".doc")) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  }

  if (text) {
    await db.insert(skillVectors).values({
      employeeId: employeeId,
      bio: text,
      embedding: [0.1, 0.2, 0.3],
    });
  }
}
