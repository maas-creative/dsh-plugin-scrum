// The upstream browser guard uses Senpi question shapes; DSH returns answer arrays.
export function browserQuestionInput(input){return {questions:(input.questions||[]).map((q,i)=>({id:'scrum-browser-action-'+i,question:q.question,header:q.header,options:q.options,multi_select:false}))}}
export function browserQuestionReply(value){
 const answers=typeof value==='string'?JSON.parse(value):value;
 if(answers?.pending)return {status:'pending',answers:{}};
 if(!Array.isArray(answers?.answers))return {status:'unavailable',answers:{}};
 return {status:'answered',answers:Object.fromEntries(answers.answers.map(a=>[a.id,Array.isArray(a.selected)&&a.selected.length===1&&!a.custom?a.selected[0]:undefined]))};
}
