import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

/** Ordered migration SQL. Apply as the schema owner; the app runs as `falaj_app`. */
export function migrationFiles(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(`${MIGRATIONS_DIR}${name}`, 'utf8') }));
}
