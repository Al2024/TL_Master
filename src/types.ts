/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ProjectType {
  BILLABLE = 'B',
  PROPOSAL = 'P',
  NON_BILLABLE = 'N',
}

export enum UpdateType {
  FORECAST = 'forecast',
  ACTUAL = 'actual',
}

export interface WeeklyAllocation {
  week: string;
  hours: number;
}

export interface Assignment {
  id: string;
  employeeId: string;
  employeeName: string;
  projectNumber: string;
  projectName: string;
  projectType: ProjectType;
  projectManager: string;
  updateType: UpdateType;
  discipline: string;
  grade: string;
  weeklyAllocations: WeeklyAllocation[];
  totalHours: number;
}

export interface Employee {
  id: string;
  name: string;
  grade: string;
  discipline: string;
  office: string;
  normalWeeklyHours: number;
}

export interface Project {
  number: string;
  name: string;
  type: ProjectType;
  manager: string;
  discipline: string;
}

export interface BiasModel {
  pmId: string;
  pmName: string;
  coefficient: number; // 1.0 means accurate, >1.0 means over-forecasts, <1.0 means under-forecasts
}
