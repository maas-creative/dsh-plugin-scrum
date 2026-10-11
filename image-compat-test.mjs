import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFile} from 'node:fs/promises';import {installImageCompatibility} from './image-compat.mjs';
test('image compatibility remains idempotent and converts after native read validation',async()=>{
 await installImageCompatibility();assert.equal((await installImageCompatibility()).installed,false);
 const source=await readFile(createRequire(import.meta.url).resolve('@deepseek-ai/dsh-tool-fs'),'utf8'),begin=source.indexOf('name: "read_image",'),body=source.slice(begin,source.indexOf('//#endregion',begin));
 assert(body.indexOf('resolveRegularReadTarget(ctx, exec, args.file_path)')<body.indexOf('await convertLookAtImage'));
 assert(body.indexOf('ctx.fs.readBytes(target, exec.signal, byteCap)')<body.indexOf('await convertLookAtImage'));
 assert(body.indexOf('assertImageCapableRoute(ctx, exec, args.file_path)')<body.indexOf('await convertLookAtImage'));
 assert(body.includes('attachments.saveImage({'));assert(body.includes('...await convertLookAtImage({data,mediaType},exec.signal)'));
});
