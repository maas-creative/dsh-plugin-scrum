// The original events remain untouched. Each delta applies to the preceding
// dashboard ledger in the same summarization input.
export function createLedgerSnapshotCompactor(){
 let previous,previousNow;
 return message=>{
  if(message?.role!=='user'||message.source?.kind!=='agent-message'||message.content?.length!==1||message.content[0]?.type!=='text')return message;
  let payload;try{payload=JSON.parse(message.content[0].text)}catch{return message}
  const ledger=payload?.ledger;if(typeof payload?.now!=='string'||!Array.isArray(payload.documents)||!ledger||typeof ledger!=='object'||Array.isArray(ledger)||!Array.isArray(ledger.tasks)||!Array.isArray(ledger.projects)){if(payload&&Object.hasOwn(payload,'ledger')){previous=undefined;previousNow=undefined}return message}
  if(!previous){previous=ledger;previousNow=payload.now;return message}
  const changed=Object.create(null),removed=[];
  for(const key of Object.keys(ledger))if(!Object.hasOwn(previous,key)||JSON.stringify(previous[key])!==JSON.stringify(ledger[key]))changed[key]=ledger[key];
  for(const key of Object.keys(previous))if(!Object.hasOwn(ledger,key))removed.push(key);
  const baseNow=previousNow;previous=ledger;previousNow=payload.now;
  const text='これは直前の台帳入力からの差分です。changedを上書きしremovedを削除し、記載のない項目は直前の値を維持してください。\n'+JSON.stringify({...payload,ledger:{__dashboard_ledger_delta_v1:{baseNow,changed,removed}}});
  return text.length<message.content[0].text.length?{...message,content:[{...message.content[0],text}]}:message;
 };
}
export function compactLedgerSnapshots(messages){return messages.map(createLedgerSnapshotCompactor())}
