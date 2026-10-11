// Scrum configuration data operations; JSONC syntax uses Microsoft's MIT parser.
import{parse}from'jsonc-parser';
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const unsafe=new Set(['__proto__','constructor','prototype']);
export function parseJsonc(text,errors=[]){return parse(text,errors,{allowTrailingComma:true,disallowComments:false})}
export function mergeOmoConfigRecords(base,overlay){
 const merge=(left,right,depth)=>{if(depth>128)throw Error('Configuration nesting exceeds supported depth');if(!record(right))return structuredClone(right);const out=record(left)?structuredClone(left):{};for(const[key,value]of Object.entries(right)){if(unsafe.has(key))throw Error('Unsafe configuration field: '+key);out[key]=record(value)?merge(out[key],value,depth+1):structuredClone(value)}return out};return merge(base,overlay,0);
}
export function resolveModelReferences(config){
 const view=structuredClone(config),diagnostics=[],catalog=record(view.models)?view.models:{},invalid=new Set();
 for(const key of Object.keys(catalog)){
  const seen=new Set();let current=key;
  while(record(catalog[current])&&typeof catalog[current].model==='string'&&Object.hasOwn(catalog,catalog[current].model)){
   if(seen.has(current)){invalid.add(key);diagnostics.push({kind:'model_catalog_cycle',path:'models.'+key+'.model',message:'Model alias cycle includes '+key});break}seen.add(current);current=catalog[current].model;
  }
 }
 const reference=name=>typeof name==='string'&&!invalid.has(name)&&Object.hasOwn(catalog,name)&&record(catalog[name])&&typeof catalog[name].model==='string'?catalog[name]:undefined;
 const entry=value=>{if(typeof value==='string'){const selected=reference(value);return selected?(selected.reasoning===undefined?selected.model:{model:selected.model,reasoning:selected.reasoning}):value}if(record(value)){const selected=reference(value.model);return selected?{...value,model:selected.model,...(value.reasoning===undefined&&selected.reasoning!==undefined?{reasoning:selected.reasoning}:{})}:value}return value};
 for(const section of ['agents','categories','model_profiles'])if(record(view[section]))for(const row of Object.values(view[section])){if(!record(row))continue;const selected=reference(row.model);if(selected){row.model=selected.model;if(row.reasoning===undefined&&selected.reasoning!==undefined)row.reasoning=selected.reasoning}if(Array.isArray(row.models))row.models=row.models.map(entry)}
 return{view,diagnostics};
}
