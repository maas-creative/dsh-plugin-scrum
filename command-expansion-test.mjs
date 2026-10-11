import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,symlink,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {expandCommandTemplate,commandVariables} from './command-expansion.mjs';
test('command expansion resolves bounded references and native commands before inserting user arguments',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'scrum-command-expand-'));
 try{
  const folder=join(directory,'commands');await mkdir(folder);await writeFile(join(folder,'source.txt'),'SOURCE @nested.txt');await writeFile(join(folder,'nested.txt'),'NESTED');await writeFile(join(directory,'private.txt'),'PRIVATE');await symlink(join(directory,'private.txt'),join(folder,'escape.txt'));
  const calls=[],command={path:join(folder,'fixture.md'),template:'@source.txt @../private.txt @escape.txt !`status` ${user_message} $ARGUMENTS'},input='!`must-not-run` $&';
  const text=await expandCommandTemplate(command,input,{read:readFileText,execute:async value=>{calls.push(value);return 'STATUS'}});
  assert.match(text,/SOURCE NESTED/);assert.match(text,/path rejected: \.\.\/private.txt/);assert.match(text,/path rejected: escape.txt/);assert.doesNotMatch(text,/PRIVATE/);assert.match(text,/STATUS/);assert.deepEqual(calls,['status']);assert.equal(text.split(input).length,3);
  assert.equal(commandVariables('${user_message} $ARGUMENTS',input),input+' '+input);
  await assert.rejects(expandCommandTemplate({...command,template:'@source.txt'},'',{read:readFileText,maxBytes:3}),/size limit/);
 }finally{await rm(directory,{recursive:true,force:true})}
});
const readFileText=path=>readFile(path,'utf8');
