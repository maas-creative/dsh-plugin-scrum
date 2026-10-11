import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('separately licensed AST skill accepts interspersed paths and preserves dry-run versus explicit apply', () => {
  const dir=mkdtempSync(join(tmpdir(),'scrum-mit-ast-'));
  const helper=resolve('skills/ast-grep/scripts/ast_grep_helper.py');
  const env={...process.env,PATH:resolve('node_modules/@ast-grep/cli')+':'+process.env.PATH};
  const invoke=args=>spawnSync('python3',[helper,...args],{cwd:dir,env,encoding:'utf8',timeout:15000});
  try {
    const file=join(dir,'source.ts'),source='const label = "日本語"; console.log(label);\n';
    writeFileSync(file,source);
    const search=invoke(['search','console.log($MSG)','--lang','ts',file,'--json-out']);
    assert.equal(search.status,0,search.stderr);
    assert.equal(JSON.parse(search.stdout).length,1);
    const preview=invoke(['replace','console.log($MSG)','logger.info($MSG)','--lang','ts',file]);
    assert.equal(preview.status,0,preview.stderr);
    assert.match(preview.stdout,/DRY-RUN/);
    assert.equal(readFileSync(file,'utf8'),source);
    const bad=invoke(['replace','console.log($MSG)','logger.info($MSG)','--lang','ts',file,'--unknown-option']);
    assert.equal(bad.status,2);
    assert.equal(readFileSync(file,'utf8'),source);
    const apply=invoke(['replace','console.log($MSG)','logger.info($MSG)','--lang','ts',file,'--apply']);
    assert.equal(apply.status,0,apply.stderr);
    assert.equal(readFileSync(file,'utf8'),'const label = "日本語"; logger.info(label);\n');
  } finally {rmSync(dir,{recursive:true,force:true});}
});
