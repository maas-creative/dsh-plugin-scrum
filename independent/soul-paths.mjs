import {posix} from 'node:path';

export const SOUL_PATHS = Object.freeze(['system/persona.md', 'system/identity.md', 'system/boundaries.md']);
export const SOUL_EDIT_RESULT_LINE = 'A soul edit changed the agent identity policy. Tell the user which policy changed before continuing.';
export function touchesSoulPath(paths) {
  if (!Array.isArray(paths)) return false;
  return paths.some(value => typeof value === 'string' && SOUL_PATHS.includes(posix.normalize(value.replaceAll('\\', '/'))));
}
