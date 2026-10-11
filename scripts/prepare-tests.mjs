// Copyright (c) 2026 MaaS Creative. SPDX-License-Identifier: AGPL-3.0-only
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
if(process.platform!=='darwin'||process.arch!=='arm64')throw Error('This native acceptance setup currently targets macOS arm64. Configure Python and Texlab explicitly on other platforms.');
execFileSync('uv',['venv','--python','3.12',join(root,'.test-venv')],{stdio:'inherit'});
execFileSync('uv',['pip','install','--python',join(root,'.test-venv/bin/python'),'-r',join(root,'test-python-requirements.txt')],{stdio:'inherit'});
const directory=join(root,'.test-tools');await mkdir(directory,{recursive:true});
const response=await fetch('https://github.com/latex-lsp/texlab/releases/download/v5.26.0/texlab-aarch64-macos.tar.gz',{signal:AbortSignal.timeout(60000)});
if(!response.ok)throw Error('Texlab download failed: '+response.status);
const bytes=Buffer.from(await response.arrayBuffer());
if(createHash('sha256').update(bytes).digest('hex')!=='af7972ffd230711ba04ada9b69cc32ce9111d9196ba69538062872faefdbee56')throw Error('Texlab archive integrity mismatch');
const archive=join(directory,'texlab.tar.gz');await writeFile(archive,bytes);
execFileSync('tar',['-xzf',archive,'-C',directory,'texlab'],{stdio:'inherit'});
execFileSync(join(directory,'texlab'),['--version'],{stdio:'inherit'});
console.log('Test prerequisites prepared. Run npm test.');
