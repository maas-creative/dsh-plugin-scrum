// One conservative deferral avoids discarding a demonstrably warm prefix.
// Missing measurements never count as a hit; overflow and manual paths bypass this.
export function shouldDeferForCache({route,events,currentTokens,contextWindow,maxTokens,pressureThreshold,alreadyDeferred}){
 if(alreadyDeferred||route?.provider!=='local-glm'||route?.model!=='glm53-fast'||!Number.isSafeInteger(currentTokens)||currentTokens<0||!Number.isSafeInteger(contextWindow)||contextWindow<=0||!Number.isSafeInteger(maxTokens)||maxTokens<=0||!Number.isSafeInteger(pressureThreshold)||currentTokens<pressureThreshold||!Array.isArray(events))return false;
 const boundary=events.findLastIndex(e=>e.type==='compaction/end'||e.type==='request/header');
 const calls=events.slice(boundary+1).filter(e=>e.type==='assistant/message'&&e.data?.usage).slice(-2);
 if(calls.length!==2)return false;
 const [previous,last]=calls.map(e=>e.data.usage),valid=u=>Number.isSafeInteger(u.totalTokens)&&Number.isSafeInteger(u.outputTokens)&&Number.isSafeInteger(u.inputTokens)&&u.totalTokens>=u.outputTokens&&u.inputTokens>=0;
 if(!valid(previous)||!valid(last)||!Number.isSafeInteger(last.cacheReadTokens)||last.cacheReadTokens<=last.inputTokens)return false;
 const previousPrompt=previous.totalTokens-previous.outputTokens,lastPrompt=last.totalTokens-last.outputTokens;
 if(last.cacheReadTokens>lastPrompt||last.inputTokens+last.cacheReadTokens>lastPrompt)return false;
 const growth=Math.max(0,lastPrompt-previousPrompt,currentTokens-lastPrompt);
 const reserve=maxTokens+Math.max(maxTokens,growth);
 return Number.isSafeInteger(reserve)&&currentTokens+reserve<contextWindow;
}
