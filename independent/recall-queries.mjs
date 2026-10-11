const omitted=new Set('a an the and or of to for in on with from by what which how why when where should could would do does did we i you it this that please inspect about cat read grep find'.split(' '));
export function planRecallQueries(texts,{toolTexts=[]}={}){
 const queries=[];const add=value=>{if(value&&!queries.includes(value)&&queries.length<4)queries.push(value);};
 // File identifiers often provide stronger lookup keys than shell syntax.
 for(const text of toolTexts)for(const path of String(text).matchAll(/(?:[\w.-]+\/)+([\w.-]+)/g))for(const token of path[1].replace(/\.[^.]+$/,'').split(/[_-]+/))if(token.length>2&&!omitted.has(token.toLowerCase()))add(token);
 for(const text of texts){const tokens=(String(text).match(/[\p{L}\p{N}]+/gu)||[]).filter(token=>token.length>1&&!omitted.has(token.toLowerCase()));add(tokens.join(' '));if(tokens.length>2)add(tokens.slice(-2).join(' '));if(tokens.length>2)add(tokens.slice(1).join(' '));for(const phrase of String(text).matchAll(/["“]([^"”]+)["”]/g))add('"'+phrase[1]+'"');}
 return queries;
}
