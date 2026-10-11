import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const launcher=fileURLToPath(new URL('./skills/data-scientist/scripts/quick-query.py',import.meta.url));
test('data query help needs only the Python standard library and retains public options',()=>{
 const result=spawnSync('python3',[launcher,'--help'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);for(const flag of ['--filter','--describe','sql','file'])assert(result.stdout.includes(flag));
});
test('data query missing file fails clearly before importing dataframe engines',()=>{
 const result=spawnSync('python3',[launcher,'/nonexistent/scrum-data.csv'],{encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/Data file does not exist/);assert(!result.stderr.includes('ModuleNotFoundError'));
});

// Engine dependencies are explicit developer prerequisites; no installs or skips.
import {existsSync} from 'node:fs';
const developmentPython=fileURLToPath(new URL('./work/independent-data-query/venv/bin/python',import.meta.url));
test('real dataframe engines preserve all supported formats, filters, aggregates and CSV date arithmetic',()=>{
 const python=process.env.SCRUM_DATA_QUERY_PYTHON||(existsSync(developmentPython)?developmentPython:'python3');
 const source=fileURLToPath(new URL('./independent/data-query.py',import.meta.url));
 const code=`import sys,importlib.util,tempfile,datetime
from pathlib import Path
import polars as pl
spec=importlib.util.spec_from_file_location('independent_query',sys.argv[1]);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
with tempfile.TemporaryDirectory(prefix='scrum-data-engine-') as directory:
 root=Path(directory);frame=pl.DataFrame({'name':['東京','大阪'],'amount':[10,200]})
 writers={'.csv':frame.write_csv,'.parquet':frame.write_parquet,'.json':frame.write_json,'.ndjson':frame.write_ndjson,'.jsonl':frame.write_ndjson}
 for extension,write in writers.items():
  file=root/('input with spaces and quote\\''+extension);write(file)
  result=module.query(file,sql='SELECT name FROM data WHERE amount > 100');assert result['name'].to_list()==['大阪'],extension
  result=module.query(file,filter_expr='amount > 100');assert result['name'].to_list()==['大阪'],extension
  result=module.query(file,sql='SELECT SUM(amount) AS total FROM data');assert result['total'].to_list()==[210],extension
  assert module.query(file,describe=True).height>0,extension
 file=root/'dates.csv';file.write_text('day,value\\n2026-10-01,1\\n2026-10-02,2\\n')
 result=module.query(file,sql="SELECT day + INTERVAL '1 day' AS tomorrow FROM data ORDER BY day")
 assert result['tomorrow'].to_list()==[datetime.datetime(2026,10,2),datetime.datetime(2026,10,3)]
`;
 const result=spawnSync(python,['-c',code,source],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});assert.equal(result.status,0,result.stderr||result.error?.message);assert(!result.stderr.includes('DeprecationWarning'));
});
