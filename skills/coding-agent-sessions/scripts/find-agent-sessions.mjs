#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {run} from '../../../vendor/session-finder-independent/runtime/cli.mjs';
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
process.env.SCRUM_SESSION_FINDER_COMMAND='node '+quote(fileURLToPath(import.meta.url));
try{process.exitCode=await run(process.argv.slice(2))}catch(error){console.error(error.message);process.exitCode=1}
