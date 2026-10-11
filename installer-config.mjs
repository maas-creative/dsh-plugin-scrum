import {randomUUID} from 'node:crypto';
import {roles} from './roles.mjs';
import {categories} from './categories.mjs';
import {saveModel,defaultModel} from './models.mjs';
function declaresFixedModel(catalog){return Array.isArray(catalog)&&catalog.length<=100&&catalog.some(provider=>provider?.provider===defaultModel.provider&&Array.isArray(provider.models)&&provider.models.length<=10000&&provider.models.some(model=>model?.id===defaultModel.model));}
// The caller must enforce master/session ownership before invoking this API.
// Native CLI validates actual provider capabilities; an available host catalog is
// checked independently before accepting the forwarded route declaration.
export function installNativeConfiguration(store,args,ownerSessionId,{hostCatalog}={}){
 if(typeof ownerSessionId!=='string'||!ownerSessionId||ownerSessionId.length>256)throw Error('Native installer owner session required');
 if(!declaresFixedModel(args?.catalog))throw Error('Native installer catalog lacks required fixed model');
 if(hostCatalog!==undefined&&!declaresFixedModel(hostCatalog))throw Error('Host provider catalog lacks required fixed model');
 return installNativeModels(store,args.catalog,ownerSessionId);
}
export function installNativeModels(store,catalog,ownerSessionId){
 if(!declaresFixedModel(catalog))throw Error('Configured native provider catalog lacks required GPT6.1Sol model');
 const backupKey='scrumInstallerBackup:'+ownerSessionId+':'+randomUUID();
 return store.tx(()=>{const previous=store.setting('workerModels',null);store.set(backupKey,{ownerSessionId,createdAt:new Date().toISOString(),workerModels:previous});if(!previous?.default)saveModel(store,{model:defaultModel},catalog);const addedRoles=Object.keys(roles).filter(role=>!previous?.roles?.[role]);for(const role of addedRoles)saveModel(store,{role,model:defaultModel},catalog);const addedCategories=Object.keys(categories).filter(category=>!previous?.categories?.[category]);for(const category of addedCategories)saveModel(store,{category,model:defaultModel},catalog);return {backupKey,categories:addedCategories,default:store.setting('workerModels',{}).default,roles:addedRoles,preservedCustomSettings:true,persisted:true,settingsKey:'workerModels'};});
}
