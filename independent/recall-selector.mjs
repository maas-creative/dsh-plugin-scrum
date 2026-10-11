import {chooseRecallStrategy,hasCjk} from './recall-policy.mjs';

export const RECALL_EXPANSION_WEIGHTS=Object.freeze({synonyms:0.75,keywords:0.75,related:0.4,noteLine:0.4});
const normalize=text=>String(text??'').normalize('NFKC').toLowerCase();
function terms(text){
 const result=[];
 for(const word of normalize(text).match(/[\p{L}\p{N}_]+/gu)||[]){
  if(!hasCjk(word)){result.push(word);continue;}
  const chars=[...word];if(chars.length===1)result.push(word);
  else for(let i=0;i<chars.length-1;i++)result.push(chars[i]+chars[i+1]);
 }
 return result;
}
const counts=words=>{const map=new Map();for(const word of words)map.set(word,(map.get(word)||0)+1);return map;};
const ordered=(rows,key)=>rows.filter(row=>row[key]>0).sort((a,b)=>b[key]-a[key]||a.document.path.localeCompare(b.document.path));

// Independent lexical retrieval: phrase/term matching for small Latin corpora,
// BM25 with Unicode bigrams for CJK, and reciprocal-rank fusion for large corpora.
// BM25 parameters/IDF are documented by Apache Lucene's BM25Similarity API.
export function selectRecallCandidates(documents,queries,{maxItems=3,surfaced=new Set(),expansions={}}={}){
 if(!Number.isSafeInteger(maxItems)||maxItems<0)throw Error('Invalid recall candidate count');
 if(!maxItems||!queries.length)return [];
 const requests=queries.filter(q=>typeof q==='string'&&q.trim()).map(text=>({text:normalize(text),weight:1}));
 for(const [key,weight]of Object.entries(RECALL_EXPANSION_WEIGHTS)){
  const values=key==='noteLine'?[expansions[key]]:expansions[key]||[];
  for(const text of values)if(typeof text==='string'&&text.trim())requests.push({text:normalize(text),weight});
 }
 if(!requests.length)return [];
 const records=documents.map(document=>{const body=normalize(document.body),title=normalize(document.description),path=normalize(document.path),words=terms(title+' '+body);return {document,body,title,path,frequency:counts(words),length:words.length,lexical:0,bm25:0};});
 const average=records.reduce((sum,row)=>sum+row.length,0)/(records.length||1)||1;
 const documentFrequency=new Map();for(const row of records)for(const word of row.frequency.keys())documentFrequency.set(word,(documentFrequency.get(word)||0)+1);
 for(const row of records)for(const request of requests){
  const unique=[...new Set(terms(request.text))];
  let exact=(row.title.includes(request.text)?4:0)+(row.body.includes(request.text)?3:0)+(row.path.includes(request.text)?1:0);
  for(const term of unique)exact+=(row.title.includes(term)?2:0)+(row.body.includes(term)?1:0);
  row.lexical+=request.weight*exact;
  for(const term of unique){const frequency=row.frequency.get(term)||0;if(!frequency)continue;const df=documentFrequency.get(term);const idf=Math.log(1+(records.length-df+0.5)/(df+0.5));row.bm25+=request.weight*idf*(frequency*2.2)/(frequency+1.2*(0.25+0.75*row.length/average));}
 }
 const strategy=chooseRecallStrategy(documents,queries);let ranked;
 if(strategy==='hybrid'){
  const fused=new Map();for(const channel of ['lexical','bm25'])ordered(records,channel).forEach((row,index)=>fused.set(row,(fused.get(row)||0)+1/(60+index+1)));
  ranked=[...fused].map(([row,score])=>({...row,score})).sort((a,b)=>b.score-a.score||a.document.path.localeCompare(b.document.path));
 }else{const channel=strategy==='bm25'?'bm25':'lexical';ranked=ordered(records,channel).map(row=>({...row,score:row[channel]}));}
 const hints=requests.flatMap(request=>terms(request.text));
 return ranked.filter(row=>!surfaced.has(row.document.path)).slice(0,maxItems).map(({document,score})=>{
  const body=String(document.body??''),lines=body.split(/\r?\n/),best=lines.map((text,index)=>({text,index,hits:hints.filter(term=>normalize(text).includes(term)).length})).sort((a,b)=>b.hits-a.hits||a.index-b.index)[0];
  const line=best?.text||body,lower=normalize(line),matches=hints.map(term=>lower.indexOf(term)).filter(index=>index>=0);
  let start=Math.max(0,(matches.length?Math.min(...matches):0)-160),end=Math.min(line.length,start+800);
  if(start>0&&/[\uDC00-\uDFFF]/.test(line[start]))start--;
  if(end<line.length&&/[\uD800-\uDBFF]/.test(line[end-1]))end--;
  return {path:document.path,description:String(document.description??''),excerpt:line.slice(start,end),score};
 });
}
