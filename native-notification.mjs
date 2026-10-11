export async function recordParentNotice(ctx,agent,input,createUserMessage){
 if(agent.status==='running')throw Error('親は実行中です');
 if(typeof input.notificationId!=='string'||!input.notificationId||typeof input.message!=='string'||input.message.length>200000)throw Error('通知の形式が不正です');
 const marker='Scrum notification '+input.notificationId+'\n';
 const text=m=>typeof m.content==='string'?m.content:(m.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');
 const messages=[...agent.session.deriveMessages(),...agent.inbox.nextStep,...agent.inbox.nextTurn];
 if(!messages.some(m=>text(m).startsWith(marker)))agent.session.append('user/message',createUserMessage({content:[{type:'text',text:marker+input.message}],source:{kind:'subagent-settled',form:'notice',summary:'Scrum担当の終了報告（成果物は未検証）',senderSessionId:input.senderSessionId||agent.session.id}}),{surfaceOp:'append'});
 await ctx.sessions.flush(agent.session);return {recorded:true};
}


// The durable session log is the receipt. A crash after flush but before the
// mailbox update retries the same marker, rather than appending another notice.
export async function recordParentMailbox(ctx,agent,store,createUserMessage){
 const key='scrumMailbox:'+agent.session.id;
 for(const message of store.setting(key,[]).filter(m=>!m.read)){
  await recordParentNotice(ctx,agent,{notificationId:'mail:'+message.id,senderSessionId:message.from,message:JSON.stringify(message)},createUserMessage);
  store.tx(()=>store.set(key,store.setting(key,[]).map(m=>m.id===message.id?{...m,read:true,deliveredAt:Date.now(),deliveryId:'mail:'+message.id}:m)));
 }
}
