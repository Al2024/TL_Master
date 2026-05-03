/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { parse } from 'csv-parse/sync';
import * as pdfImport from 'pdf-parse';
const pdf = (pdfImport as any).default || pdfImport;
import mammoth from 'mammoth';
import { getDb } from '../db/index';
import { assignments, weeklyAllocations, employees, skillVectors } from '../db/schema';
import { ProjectType, UpdateType } from '../types';

export async function ingestCSV(buffer: Buffer) {
  const db = getDb();
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });

  // Example record processing based on TL Master format
  for (const record of records) {
    const employeeInfo = record['Employee'] || '';
    const [name, id] = employeeInfo.split(' : ').map((s: string) => s.trim());
    
    if (!id) continue;

    // Upsert employee
    await db.insert(employees)
      .values({
        id: id,
        name: name || 'Unknown',
        grade: record['Employee Grade'],
        discipline: record['Discipline'],
        office: record['Office'],
      })
      .onConflictDoUpdate({
        target: employees.id,
        set: { name, grade: record['Employee Grade'] }
      });

    // Ingest Assignment
    const typeStr = record['Type']?.toLowerCase();
    const updateType = typeStr === 'actual' ? UpdateType.ACTUAL : UpdateType.FORECAST;
    
    const [newAssignment] = await db.insert(assignments).values({
      employeeId: id,
      projectNumber: record['ProjectNumber'],
      projectName: record['ProjectName'],
      projectType: (record['Project Type'] as any) || ProjectType.BILLABLE,
      projectManager: record['Project Manager'],
      updateType: updateType,
      totalHours: parseFloat(record['Overall Total Project Hours']?.replace(/,/g, '') || '0'),
    }).returning();

    // Ingest Weekly Allocations (Keys like "2026 02-Jan")
    const weekRegex = /^\d{4} \d{2}-[A-Za-z]{3}$/;
    for (const [key, value] of Object.entries(record)) {
      if (weekRegex.test(key) && value) {
        const hours = parseFloat((value as string).replace(/,/g, ''));
        if (!isNaN(hours) && hours > 0) {
          await db.insert(weeklyAllocations).values({
            assignmentId: newAssignment.id,
            week: key,
            hours: hours
          });
        }
      }
    }
  }
}

export async function ingestCV(buffer: Buffer, originalname: string, employeeId: string) {
  const db = getDb();
  let text = '';
  
  if (originalname.endsWith('.pdf')) {
    const data = await pdf(buffer);
    text = data.text;
  } else if (originalname.endsWith('.docx') || originalname.endsWith('.doc')) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  }

  if (text) {
    // In a production app, we would call Gemini to generate embeddings here.
    // For now, we store the bio text.
    await db.insert(skillVectors).values({
      employeeId: employeeId,
      bio: text,
      embedding: [0.1, 0.2, 0.3] // Placeholder vector
    });
  }
}
