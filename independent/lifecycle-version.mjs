// Independently authored comparator for the observed lifecycle version API.
function parse(value) {
 if(typeof value!=='string')return null;
 const match=/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value.trim());
 if(!match)return null;
 return {core:match.slice(1,4).map(BigInt),pre:match[4]?.split('.')??[]};
}
const order=(a,b)=>a===b?0:a<b?-1:1;
export function compareSemverVersions(left,right) {
 const a=parse(left),b=parse(right);if(!a||!b)return null;
 for(let i=0;i<3;i++){const result=order(a.core[i],b.core[i]);if(result)return result}
 if(!a.pre.length||!b.pre.length)return a.pre.length?-1:b.pre.length?1:0;
 for(let i=0;i<Math.max(a.pre.length,b.pre.length);i++) {
  if(a.pre[i]===undefined)return -1;if(b.pre[i]===undefined)return 1;
  const x=a.pre[i],y=b.pre[i],xn=/^\d+$/.test(x),yn=/^\d+$/.test(y);
  const result=xn&&yn?order(BigInt(x),BigInt(y)):xn!==yn?(xn?-1:1):order(x,y);
  if(result)return result;
 }
 return 0;
}
export function isStrictlyNewerVersion(current,candidate){return compareSemverVersions(current,candidate)===-1}
