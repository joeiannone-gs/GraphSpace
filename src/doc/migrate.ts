/**
 * Upgrades stored documents to the current schema. Each schema change adds a step here, so old
 * projects, commits and share links keep opening.
 */
import { parseDoc } from './schema';
import { CURRENT_SCHEMA_VERSION, type ProjectDoc } from './types';

type Step = (doc: Record<string, unknown>) => Record<string, unknown>;

/** steps[n] upgrades version n to n + 1. */
const steps: Record<number, Step> = {};

export function migrate(raw: unknown): ProjectDoc {
  if (typeof raw !== 'object' || raw === null) throw new Error('Not a project document');
  let doc = raw as Record<string, unknown>;
  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error('This project was saved by a newer version of GraphSpace. Reload the page.');
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = steps[version];
    if (!step) throw new Error(`No upgrade from schema version ${version}`);
    doc = step(doc);
    version++;
  }
  return parseDoc({ ...doc, schemaVersion: CURRENT_SCHEMA_VERSION });
}
