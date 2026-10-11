import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
export function executionContext(store,task){return store.executionOnly?{id:task.id,cwd:task.cwd,outcome:task.body,completionCriteria:task.completionCriteria,execution:'auto'}:store.get('SELECT * FROM projects WHERE id=?',task.projectId)}
export class ExecutionStore {
 constructor(path){this.executionOnly=true;mkdirSync(dirname(path),{recursive:true,mode:0o700});this.db=new DatabaseSync(path);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,parentSession TEXT NOT NULL,cwd TEXT NOT NULL,projectId TEXT,title TEXT NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,nextAction TEXT NOT NULL DEFAULT '',due INTEGER,dependencies TEXT NOT NULL DEFAULT '[]',version INTEGER NOT NULL DEFAULT 1,body TEXT NOT NULL DEFAULT '',inputs TEXT NOT NULL DEFAULT '',output TEXT NOT NULL DEFAULT '',parentId TEXT,waitReason TEXT NOT NULL DEFAULT '',waitingFor TEXT NOT NULL DEFAULT '',checkAt INTEGER,planDay TEXT NOT NULL DEFAULT '',completedAt INTEGER,completionCriteria TEXT NOT NULL DEFAULT '',completionEvidence TEXT NOT NULL DEFAULT '',canonicalTarget TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,source TEXT NOT NULL,title TEXT NOT NULL,cwd TEXT NOT NULL,path TEXT NOT NULL,status TEXT NOT NULL,observed INTEGER NOT NULL,checked INTEGER NOT NULL,projectId TEXT,detail TEXT NOT NULL,threadId TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS task_runs(taskId TEXT NOT NULL REFERENCES tasks(id),runId TEXT NOT NULL REFERENCES runs(id),PRIMARY KEY(taskId,runId));
 CREATE TABLE IF NOT EXISTS deliverables(id TEXT PRIMARY KEY,projectId TEXT,path TEXT NOT NULL,hash TEXT NOT NULL,reviewed INTEGER NOT NULL,checked INTEGER NOT NULL);`);}
 all(sql,...args){return this.db.prepare(sql).all(...args)}
 get(sql,...args){return this.db.prepare(sql).get(...args)}
 run(sql,...args){return this.db.prepare(sql).run(...args)}
 tx(fn){const nested=this.db.isTransaction;this.db.exec(nested?'SAVEPOINT execution_write':'BEGIN IMMEDIATE');try{const result=fn();this.db.exec(nested?'RELEASE execution_write':'COMMIT');return result}catch(error){this.db.exec(nested?'ROLLBACK TO execution_write':'ROLLBACK');if(nested)this.db.exec('RELEASE execution_write');throw error}}
 setting(key,fallback){const row=this.get('SELECT value FROM settings WHERE key=?',key);return row?JSON.parse(row.value):fallback}
 set(key,value){this.run('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,JSON.stringify(value))}
 requireProject(){throw Error('Business projects belong to Dashboard; use an execution task with cwd')}
 task(input){return this.tx(()=>{
 const old=input.id?this.get('SELECT * FROM tasks WHERE id=?',input.id):null;if(input.id&&(!old||old.version!==input.version))throw Error('Execution task version changed');
 const value={...old,...input},id=old?.id||randomUUID();
 for(const key of ['parentSession','cwd','title'])if(typeof value[key]!=='string'||!value[key].trim()||value[key].length>4000)throw Error('Execution task requires '+key);
 if(!isAbsolute(value.cwd))throw Error('Execution cwd must be absolute');if(old&&value.parentSession!==old.parentSession)throw Error('Execution owner cannot change');
 if(value.projectId)throw Error('Business projectId is not an execution context');
 if(!['todo','doing','waiting','review','done','cancelled','reported'].includes(value.status))throw Error('Invalid execution status');
 const dependencies=value.dependencies??(old?JSON.parse(old.dependencies):[]);if(!Array.isArray(dependencies)||dependencies.length>50||new Set(dependencies).size!==dependencies.length)throw Error('Invalid execution dependencies');
 for(const dependency of dependencies){const task=this.get('SELECT * FROM tasks WHERE id=?',dependency);if(!task||task.parentSession!==value.parentSession||dependency===id)throw Error('Dependency outside parent');}
 if(value.parentId){const parent=this.get('SELECT * FROM tasks WHERE id=?',value.parentId);if(!parent||parent.parentSession!==value.parentSession||value.parentId===id)throw Error('Invalid execution parent');}
 const graph=new Map(this.all('SELECT id,dependencies,parentId FROM tasks').map(t=>[t.id,{dependencies:JSON.parse(t.dependencies),parentId:t.parentId}]));graph.set(id,{dependencies,parentId:value.parentId});
 for(const [child,t] of graph)if(t.parentId)graph.get(t.parentId)?.dependencies.push(child);
 const done=new Set(),visiting=new Set();const visit=key=>{if(visiting.has(key))throw Error('Execution dependency cycle');if(done.has(key))return;visiting.add(key);for(const dep of graph.get(key)?.dependencies||[])visit(dep);visiting.delete(key);done.add(key)};for(const key of graph.keys())visit(key);
 if(value.status==='done'&&([...graph].some(([child,t])=>t.parentId===id&&!['done','cancelled'].includes(this.get('SELECT status FROM tasks WHERE id=?',child)?.status))||!value.completionCriteria||!value.completionEvidence||dependencies.some(dep=>this.get('SELECT status FROM tasks WHERE id=?',dep)?.status!=='done')))throw Error('Verified evidence and completed dependencies required');
 for(const task of this.all("SELECT id,dependencies FROM tasks WHERE status='done'"))if(task.id!==id&&JSON.parse(task.dependencies).includes(id)&&value.status!=='done')throw Error('Completed dependent must be reopened first');
 const fields={parentSession:value.parentSession,cwd:resolve(value.cwd),projectId:null,title:value.title,status:value.status,owner:value.owner||'Pi',nextAction:value.nextAction||'',dependencies:JSON.stringify(dependencies),body:value.body||'',inputs:value.inputs||'',output:value.output||'',parentId:value.parentId||null,waitReason:value.waitReason||'',waitingFor:value.waitingFor||'',completionCriteria:value.completionCriteria||'',completionEvidence:value.completionEvidence||'',canonicalTarget:value.canonicalTarget||'',completedAt:value.status==='done'?Date.now():null};
 for(const key of ['body','inputs','output','completionCriteria','completionEvidence'])if(typeof fields[key]!=='string'||fields[key].length>200000)throw Error('Invalid '+key);
 if(old)this.run('UPDATE tasks SET '+Object.keys(fields).map(k=>k+'=?').join(',')+',version=version+1 WHERE id=?',...Object.values(fields),id);else this.run('INSERT INTO tasks(id,'+Object.keys(fields).join(',')+') VALUES('+Object.keys({id,...fields}).map(()=>'?').join(',')+')',id,...Object.values(fields));return id;
 })}
 binding({id,taskIds=[]}){return this.tx(()=>{for(const taskId of taskIds){if(!this.get('SELECT id FROM tasks WHERE id=?',taskId))throw Error('Execution task missing');this.run('INSERT OR IGNORE INTO task_runs VALUES(?,?)',taskId,id);this.run('UPDATE tasks SET version=version+1 WHERE id=?',taskId)}})}
 snapshot(){const tasks=this.all('SELECT * FROM tasks').map(t=>({...t,dependencies:JSON.parse(t.dependencies)}));return {executionOnly:true,now:Date.now(),projects:[],tasks:tasks.map(t=>({...t,actor:'pi',actionable:['todo','doing'].includes(t.status)&&t.dependencies.every(id=>tasks.find(x=>x.id===id)?.status==='done')&&!tasks.some(c=>c.parentId===t.id&&!['done','cancelled'].includes(c.status))})),taskRuns:this.all('SELECT * FROM task_runs'),runs:this.all('SELECT * FROM runs'),deliverables:this.all('SELECT * FROM deliverables')};}
 evaluate(){}
 close(){this.db.close()}
}
