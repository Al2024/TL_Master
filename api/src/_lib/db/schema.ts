/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { pgTable, text, serial, integer, timestamp, doublePrecision, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const employees = pgTable("employees", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  grade: varchar("grade", { length: 50 }),
  discipline: text("discipline"),
  office: text("office"),
  normalWeeklyHours: integer("normal_weekly_hours").default(40),
});

export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  employeeId: varchar("employee_id", { length: 255 }).references(() => employees.id),
  projectNumber: varchar("project_number", { length: 255 }),
  projectName: text("project_name"),
  projectType: varchar("project_type", { length: 1, enum: ["B", "P", "N"] }),
  projectManager: text("project_manager"),
  updateType: varchar("update_type", { length: 50, enum: ["forecast", "actual"] }),
  totalHours: doublePrecision("total_hours"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const weeklyAllocations = pgTable("weekly_allocations", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").references(() => assignments.id),
  week: varchar("week", { length: 50 }),
  hours: doublePrecision("hours"),
});

export const assignmentRelations = relations(assignments, ({ many }) => ({
  weeklyAllocations: many(weeklyAllocations),
}));

export const weeklyAllocationRelations = relations(weeklyAllocations, ({ one }) => ({
  assignment: one(assignments, {
    fields: [weeklyAllocations.assignmentId],
    references: [assignments.id],
  }),
}));

export const snapshots = pgTable("snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: timestamp("snapshot_date").defaultNow(),
  data: text("data"),
});

export const pmPerformance = pgTable("pm_performance", {
  pmName: text("pm_name").primaryKey(),
  accuracyRating: doublePrecision("accuracy_rating").default(1.0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const skillVectors = pgTable("skill_vectors", {
  id: serial("id").primaryKey(),
  employeeId: varchar("employee_id", { length: 255 }).references(() => employees.id),
  embedding: doublePrecision("embedding").array(),
  bio: text("bio"),
});
