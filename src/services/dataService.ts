/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Assignment, BiasModel, UpdateType } from '../types';

// Helper to extract data from the provide CSV structure
// Since we are in a demo environment, I will use the provided data as a hardcoded source
// but structure the service to be easily swappable with a real parser.

export const MOCK_CSV_DATA = `Employee,Project Type,Project,Discipline,Supervisor,Assignment Grade,Field/Office,Performance Unit,Office,Job Title,Employee Grade,Attribute 1,Attribute 2,Attribute 3,Attribute 4,Attribute 5,Project Manager,Employee Type,Normal weekly hours,Show,Grade,EmployeeGrade,HasActuals,isVirtual,IsSupervisor,IsDelete,,RowNum,EmployeeNumber,Comments,,Total Hours   to 26-Dec-2025,Total Hours   from 02-Jan-2026,Grid Hours Total,Total Hours   from 08-Jan-2027,Overall Total Project Hours,showhiddenAssignment,DisplayStatusChangedBy,DisplayStatusChangedDate,Type,SortOrder,Employee,ProjectNumber,ProjectName,DisciplineCode,DisciplineDescription,IsSystemProject,AssignmentTypeId,UpdateType,DisciplineId,ProjectId,SupervisorEmployeeNumber,EmployeeAssignmentId,CheckAdded,Isadded,IsActive,EditedDate,EditedBy,Isdrop,OverrideWeeklyHours,OverrideWeeklyHoursOption,2026 02-Jan,2026 09-Jan,2026 16-Jan,2026 23-Jan,2026 30-Jan,2026 06-Feb,2026 13-Feb,2026 20-Feb,2026 27-Feb,2026 06-Mar,2026 13-Mar,2026 20-Mar,2026 27-Mar,2026 03-Apr,2026 10-Apr,2026 17-Apr,2026 24-Apr,2026 01-May,2026 08-May,2026 15-May,2026 22-May,2026 29-May,2026 05-Jun,2026 12-Jun,2026 19-Jun,2026 26-Jun,2026 03-Jul,2026 10-Jul,2026 17-Jul,2026 24-Jul,2026 31-Jul,2026 07-Aug,2026 14-Aug,2026 21-Aug,2026 28-Aug,2026 04-Sep,2026 11-Sep,2026 18-Sep,2026 25-Sep,2026 02-Oct,2026 09-Oct,2026 16-Oct,2026 23-Oct,2026 30-Oct,2026 06-Nov,2026 13-Nov,2026 20-Nov,2027 01-Jan`;

export async function uploadForecast(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/upload/forecast', {
    method: 'POST',
    body: formData,
  });
  const text = await response.text();
  let payload: any;
  try { payload = JSON.parse(text); } catch { payload = { error: text || `HTTP ${response.status}` }; }
  if (!response.ok) {
    throw new Error(payload?.error || 'Forecast upload failed');
  }
  return payload;
}

export async function uploadCV(file: File, employeeId: string): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('employeeId', employeeId);
  const response = await fetch('/api/upload/cv', {
    method: 'POST',
    body: formData,
  });
  const text = await response.text();
  let payload: any;
  try { payload = JSON.parse(text); } catch { payload = { error: text || `HTTP ${response.status}` }; }
  if (!response.ok) {
    throw new Error(payload?.error || 'CV upload failed');
  }
  return payload;
}

// Simplified parser for the provided CSV snapshot in the prompt
export async function fetchAssignments(): Promise<Assignment[]> {
  try {
    const response = await fetch('/api/assignments');
    const result = await response.json();
    
    if (result.data && result.data.length > 0) {
      return result.data;
    }
  } catch (error) {
    console.warn("API fetch failed, falling back to mock data", error);
  }

  return [];
}

export function calculateBiasModels(assignments: Assignment[]): BiasModel[] {
  const pmGroups = assignments.reduce((acc, curr) => {
    if (!acc[curr.projectManager]) acc[curr.projectManager] = [];
    acc[curr.projectManager].push(curr);
    return acc;
  }, {} as Record<string, Assignment[]>);

  return Object.entries(pmGroups).map(([pmName, pmAssignments]) => {
    let forecastSum = 0;
    let actualSum = 0;

    const projectNumbers = Array.from(new Set(pmAssignments.map(a => a.projectNumber)));
    
    projectNumbers.forEach(pNum => {
      const forecast = pmAssignments.find(a => a.projectNumber === pNum && a.updateType === UpdateType.FORECAST);
      const actual = pmAssignments.find(a => a.projectNumber === pNum && a.updateType === UpdateType.ACTUAL);
      
      if (forecast && actual) {
        forecastSum += forecast.totalHours;
        actualSum += actual.totalHours;
      }
    });

    const coefficient = forecastSum === 0 ? 1.0 : actualSum / forecastSum;

    return {
      pmId: pmName,
      pmName: pmName,
      coefficient: coefficient
    };
  });
}

export function getAdjustedForecast(assignment: Assignment, pmBias: number): Assignment {
  if (assignment.updateType !== UpdateType.FORECAST) return assignment;

  return {
    ...assignment,
    totalHours: assignment.totalHours * pmBias,
    weeklyAllocations: assignment.weeklyAllocations.map(wa => ({
      ...wa,
      hours: wa.hours * pmBias
    }))
  };
}
