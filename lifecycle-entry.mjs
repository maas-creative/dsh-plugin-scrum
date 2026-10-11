// Stable bootstrap: pending package changes happen before any executing Scrum build is imported.
import {dirname} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {startPackageEntry,loadActivePackage} from './package-update.mjs';
const pluginDir=dirname(fileURLToPath(import.meta.url));
const update=await startPackageEntry(pluginDir);
const implementation=update.module||await loadActivePackage(pluginDir);
export const name=implementation.name,inject=implementation.inject;
export async function apply(ctx,config={}){return implementation.apply(ctx,{...config,lifecycle:{...config.lifecycle,pluginDir}})}
export const startupUpdate={kind:update.kind,version:update.version,error:update.error};
export const ScrumPlanner=implementation.ScrumPlanner,workDay=implementation.workDay,ScrumCoordinator=implementation.ScrumCoordinator;
export const recordParentNotice=implementation.recordParentNotice,ParentReports=implementation.ParentReports;
export const roles=implementation.roles,roleInstruction=implementation.roleInstruction,rolePolicy=implementation.rolePolicy;
export const selectModel=implementation.selectModel,defaultModel=implementation.defaultModel,fallbackModels=implementation.fallbackModels,mayRetryModel=implementation.mayRetryModel;
export const start=implementation.start,pause=implementation.pause,settle=implementation.settle,projectIds=implementation.projectIds,ulwInstruction=implementation.ulwInstruction;
