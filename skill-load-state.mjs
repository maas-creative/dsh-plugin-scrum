// Native tool and command paths share only successfully delivered skill bodies.
const loaded=new WeakMap();
export function markSkillLoaded(agent,name){if(!agent||typeof name!=='string'||!name)return;let names=loaded.get(agent);if(!names){names=new Set();loaded.set(agent,names)}names.add(name);}
export function hasLoadedSkill(agent,name){return loaded.get(agent)?.has(name)===true;}
export function forgetLoadedSkills(agent){loaded.delete(agent);}
