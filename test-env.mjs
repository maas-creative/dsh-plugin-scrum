import {mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,delimiter} from 'node:path';
const temp=process.env.DSH_SCRUM_TEST_TMP||fileURLToPath(new URL('../.development/Scrum/tmp/',import.meta.url));
mkdirSync(temp,{recursive:true});
process.env.TMPDIR=temp;process.env.TMP=temp;process.env.TEMP=temp;
// npm only adds this package's bin folder; peers may be installed by its host.
for(let directory=dirname(fileURLToPath(import.meta.url));;directory=dirname(directory)){
 const bin=join(directory,'node_modules','.bin');
 if(existsSync(bin))process.env.PATH=bin+delimiter+(process.env.PATH||'');
 if(dirname(directory)===directory)break;
}

// Public checkouts use an explicitly prepared, ignored local test environment.
const project=dirname(fileURLToPath(import.meta.url)),python=join(project,'.test-venv/bin/python');
if(existsSync(python)){
 for(const name of ['SCRUM_DATA_QUERY_PYTHON','SCRUM_COOKIE_PYTHON','SCRUM_PUBLIC_READER_PYTHON','SCRUM_DEBUG_PYTHON'])process.env[name]||=python;
}
const texlab=join(project,'.test-tools/texlab');if(existsSync(texlab))process.env.SCRUM_TEXLAB_EXECUTABLE||=texlab;

// Synthetic OAuth tests supply explicit non-secret client fixtures.
process.env.ANTIGRAVITY_CLIENT_ID||='fixture-client';process.env.ANTIGRAVITY_CLIENT_SECRET||='fixture-secret';
