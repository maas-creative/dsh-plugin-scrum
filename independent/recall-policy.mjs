export const MEMORY_EXPANSION_BOUNDS = Object.freeze({terms:16,termChars:80,noteLineChars:300});
export function readExpansions(input={}) {
 const result={};
 for(const key of ['synonyms','keywords','related']){
  if(input[key]===undefined)continue;
  if(!Array.isArray(input[key]))return `Invalid ${key}: expected an array.`;
  if(input[key].length>MEMORY_EXPANSION_BOUNDS.terms)return `Expansion ${key} accepts at most 16 entries.`;
  if(input[key].some(term=>typeof term!=='string'||term.length<1||term.length>80))return `Invalid ${key}: each entry must be a nonempty string no longer than 80 characters.`;
  result[key]=[...input[key]];
 }
 if(input.note_line!==undefined){if(typeof input.note_line!=='string'||input.note_line.length>300)return 'Invalid note_line: expected a string no longer than 300 characters.';result.noteLine=input.note_line;}
 return result;
}
const cjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
export const CJK_CORPUS_MIN_SHARE=0.1;
export const LARGE_CORPUS_MIN_DOCUMENTS=200;
export const hasCjk=value=>cjk.test(String(value??''));
export function corpusCjkShare(documents){
 let count=0,total=0;
 for(const document of documents)for(const character of `${document.description??''}${document.body??''}`){if(/\s/u.test(character))continue;total++;if(cjk.test(character))count++;}
 return total?count/total:0;
}
export function chooseRecallStrategy(documents,queries){
 if(documents.length>=LARGE_CORPUS_MIN_DOCUMENTS)return 'hybrid';
 return queries.some(hasCjk)||corpusCjkShare(documents)>=CJK_CORPUS_MIN_SHARE?'bm25':'substring';
}
