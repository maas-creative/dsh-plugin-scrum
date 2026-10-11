import {redactSecretLikeMaterial as redact} from './secret-filter.mjs';

export const createRemindersState = () => ({emittedKey:null});
export function generateReminders(state, {dirtyPaths=[], conflictState='none'}={}) {
  const conflict = conflictState && conflictState !== 'none';
  const key = conflict ? `conflict:${conflictState}` : dirtyPaths.length ? 'dirty' : null;
  if (!key) {state.emittedKey=null;return [];}
  if (state.emittedKey===key) return [];
  state.emittedKey=key;
  if (conflict) return [{kind:'conflict',text:`Memory maintenance is blocked by Git state ${redact(String(conflictState))}. Inspect the repository, preserve both sides of conflicting edits, and finish or explicitly abort the operation before integrating another memory job. Do not report the integration as completed.`}];
  return [{kind:'dirty',text:`Memory has uncommitted edits in ${dirtyPaths.length} path(s):\n${dirtyPaths.map(path=>'  '+redact(String(path))).join('\n')}\nCheck their source and intended contents before committing. Preserve user edits. Remote publication requires the configured human-only sync operation.`}];
}
