const own=(x,k)=>Object.hasOwn(x,k);
function alias(input,left,right){if(own(input,left)&&own(input,right)&&JSON.stringify(input[left])!==JSON.stringify(input[right]))throw Error('Conflicting task aliases: '+left+'/'+right);return own(input,left)?input[left]:input[right]}
function ids(value,label){if(value===undefined)return undefined;if(!Array.isArray(value)||value.length>50||value.some(id=>typeof id!=='string'||!id.trim())||new Set(value).size!==value.length)throw Error('Invalid '+label);return [...value]}
export function taskInputAliases(input,old){
 const body=alias(input,'body','description');if(body!==undefined&&(typeof body!=='string'||Buffer.byteLength(body)>200000))throw Error('Invalid task body');
 const replacement=ids(alias(input,'dependencies','blockedBy'),'dependencies'),added=ids(input.addBlockedBy,'addBlockedBy')||[],downstream=ids(alias(input,'addBlocks','blocks'),'addBlocks')||[];
 const before=replacement??old?.dependencies??[];
 const dependencies=[...new Set([...before,...added])];if(dependencies.length>50)throw Error('Too many dependencies');
 return {...input,...(body!==undefined?{body}:{}),dependencies,downstream};
}
