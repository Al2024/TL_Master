/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let client: any = null;
let dbInstance: any = null;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required for this operation.");
  }

  if (!dbInstance) {
    client = postgres(connectionString);
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}
