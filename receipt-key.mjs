import {createHash} from 'node:crypto';
import {normalize,resolve} from 'node:path';

// A submission is identified by the caller's instructionId. The payload hash
// makes a replay safe: the same key with the same content returns the stored
// receipt, while the same key with different content is a conflict.
export function normalizeInstructionId(value){
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='string')throw Object.assign(new Error('instructionId must be a string'),{status:400});
 const id=value.trim();
 if(!id||id.length>200||/[\u0000-\u001f\u007f]/.test(id))throw Object.assign(new Error('instructionId is invalid'),{status:400});
 return id;
}

export function canonicalPayload(input){
 const dependencies=[...new Set(input.dependencies||[])].sort();
 return {
  schemaVersion:1,
  prompt:input.prompt,
  cwd:resolve(input.cwd),
  output:normalize(input.output),
  completionCriteria:input.completionCriteria,
  role:input.role||'executor',
  model:input.model||null,
  fallbacks:input.fallbacks||[],
  dependencies,
  title:input.title||String(input.prompt).slice(0,150)
 };
}

export function payloadHash(payload){
 return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
