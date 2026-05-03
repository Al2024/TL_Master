/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let client: any = null;
let dbInstance: any = null;
let schemaInitialized = false;

function getClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required for this operation.");
  }

  if (!client) {
    client = postgres(connectionString);
  }

  return client;
}

export function getDb() {
  const sqlClient = getClient();
  if (!dbInstance) {
    dbInstance = drizzle(sqlClient, { schema });
  }
  return dbInstance;
}

export async function ensureSchema() {
  if (schemaInitialized) return;
  const sqlClient = getClient();

  await sqlClient`
    CREATE TABLE IF NOT EXISTS employees (
      id varchar(255) PRIMARY KEY,
      name text NOT NULL,
      grade varchar(50),
      discipline text,
      office text,
      normal_weekly_hours integer DEFAULT 40
    );
  `;

  await sqlClient`
    CREATE TABLE IF NOT EXISTS assignments (
      id serial PRIMARY KEY,
      employee_id varchar(255) REFERENCES employees(id),
      project_number varchar(255),
      project_name text,
      project_type varchar(1),
      project_manager text,
      update_type varchar(50),
      total_hours double precision,
      created_at timestamp DEFAULT now()
    );
  `;

  await sqlClient`
    CREATE TABLE IF NOT EXISTS weekly_allocations (
      id serial PRIMARY KEY,
      assignment_id integer REFERENCES assignments(id),
      week varchar(50),
      hours double precision
    );
  `;

  await sqlClient`
    CREATE TABLE IF NOT EXISTS skill_vectors (
      id serial PRIMARY KEY,
      employee_id varchar(255) REFERENCES employees(id),
      embedding double precision[],
      bio text
    );
  `;

  schemaInitialized = true;
}
