/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Assignment, ProjectType, UpdateType, WeeklyAllocation } from '../types';

/**
 * Calculates billability score based on assignments.
 * returns percentage 0-100
 */
export function calculateBillability(assignments: Assignment[], weekKeys: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  
  weekKeys.forEach(week => {
    let totalNormalHours = 0;
    let billableHours = 0;
    
    // In this simplified model, we'll assume a fixed capacity per employee mentioned in CSV (40 or 32 or 24)
    // For now, let's just aggregate across all assignments in that week
    assignments.forEach(a => {
      const allocation = a.weeklyAllocations.find(wa => wa.week === week);
      if (allocation) {
        if (a.projectType === ProjectType.BILLABLE) {
          billableHours += allocation.hours;
        }
        // This is a naive way to get unique employees, better to map employees first.
        // Assuming 40 capacity for now.
      }
    });

    // Mocking a total capacity of 40 * number of distinct employees
    const uniqueEmployees = new Set(assignments.map(a => a.employeeId)).size;
    const capacity = uniqueEmployees * 40;

    result[week] = capacity === 0 ? 0 : (billableHours / capacity) * 100;
  });

  return result;
}

/**
 * Detects anomalies in actuals vs forecast.
 * Identifies if actuals are significantly higher than forecast (burnout risk)
 */
export function detectBurnoutRisk(assignments: Assignment[]): string[] {
  const risks: string[] = [];
  const employees = Array.from(new Set(assignments.map(a => a.employeeId)));

  employees.forEach(id => {
    const empAssignments = assignments.filter(a => a.employeeId === id);
    const actuals = empAssignments.filter(a => a.updateType === UpdateType.ACTUAL);
    const forecasts = empAssignments.filter(a => a.updateType === UpdateType.FORECAST);

    const totalActual = actuals.reduce((sum, a) => sum + a.totalHours, 0);
    const totalForecast = forecasts.reduce((sum, a) => sum + a.totalHours, 0);

    if (totalActual > totalForecast * 1.2) {
      risks.push(id);
    }
  });

  return risks;
}
