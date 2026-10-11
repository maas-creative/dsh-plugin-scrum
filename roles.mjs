import {roleAliases,upstreamRoles,upstreamRolePrompt,scrumRoleContract} from './role-prompts.mjs';
import {loadScrumConfiguration,configurationAllows} from './configuration.mjs';
import {loadAgentDefinitions} from './agent-definitions.mjs';
export const roles={
 ...upstreamRoles,
 explore:{name:'コード探索',readOnly:true,instruction:'コードの構造と呼び出し経路を検索して、ファイルと行番号を根拠に報告する。実装は変更しない。'},
 librarian:{name:'資料調査',readOnly:true,instruction:'公式資料、OSS原資料、研究資料を照合し、出典と版を明記する。'},
 'plan-consultant':{name:'計画相談',readOnly:true,instruction:'目的、制約、見落とし、実行順序を検討し、計画の不足を報告する。'},
 'plan-reviewer':{name:'計画審査',readOnly:true,instruction:'計画の依存関係、達成可能性、完了条件を独立に審査する。承認の証拠と残る問題を記録する。'},
 architect:{name:'設計',readOnly:true,instruction:'既存構造を読み、要件に対する設計と具体的な変更範囲を報告する。'},
 designer:{name:'UI設計・実装',instruction:'既存のデザインシステムとユーザー導線に沿って実装し、実画面で検証する。'},
 writer:{name:'執筆',instruction:'入力資料に基づいて文章を作成し、主張と出典の対応を確認する。'},
 planner:{name:'計画',instruction:'成果物から依存関係と完了条件を定義し、実装を実施済みとしない。'},
 researcher:{name:'調査',instruction:'資料と公式情報を照合し、根拠と未確認事項を指定の成果物に記録する。原資料を変更しない。'},
 executor:{name:'実行',instruction:'指定範囲の成果物を作成し、実際に検証する。'},
 reviewer:{name:'レビュー',instruction:'指定成果物を独立に照合し、根拠付き指摘を指定の報告に記録する。対象実装を修正しない。'},
 validator:{name:'検証',instruction:'完了条件に対応する試験を実行し、実施・未実施・失敗を指定の報告に記録する。'}
};
export function resolveRole(role='executor'){return roleAliases[role]||role}
export function roleInstruction(role='executor',cwd,available={}){
 const original=role;role=resolveRole(role);const {config}=loadScrumConfiguration({cwd});
 if(!configurationAllows(config,'agents',original)||!configurationAllows(config,'agents',role))throw Error('担当役割は設定で無効化されています：'+original);
 const r=Object.hasOwn(roles,role)?roles[role]:loadAgentDefinitions({cwd})[role];if(!r)throw Error('未定義の担当役割です');
 const instructions=upstreamRolePrompt(['oracle','metis','momus'].includes(original)?original:role,available)||r.instruction;
 const override=config.agents?.[original]||config.agents?.[role]||{};
 if(override.disable===true)throw Error('担当役割は設定で無効化されています：'+original);
 return '担当役割：'+r.name+'。'+(instructions===r.instruction?'':r.instruction+'\n\n')+instructions+(typeof override.prompt_append==='string'?'\n'+override.prompt_append:'')+'\n\n'+scrumRoleContract;
}
export function rolePolicy(role='executor',cwd){
 roleInstruction(role,cwd);role=resolveRole(role);
 const definition=(Object.hasOwn(roles,role)?roles[role]:loadAgentDefinitions({cwd})[role]);if(definition.nativeTools){const mapping={find:['glob'],ls:['glob','read'],x_search:['web_search']},allow=definition.nativeTools.filter(rule=>rule.allow).flatMap(rule=>mapping[rule.pattern]||[rule.pattern]);if(definition.readOnly){return {readOnly:true,allow:[...new Set([...allow.filter(name=>!['bash','write','edit'].includes(name)),'skill','scrum_report','workpool','hashline_read','session_read','session_search','memory_read','memory_search'])]}}return {readOnly:false,allow:[...new Set([...allow,'skill','scrum_report','workpool','hashline_read','session_read','session_search','memory_read','memory_search'])]};}
 if(definition.tools)return {readOnly:definition.readOnly,allow:[...new Set([...definition.tools,'scrum_report','workpool'])].filter(name=>!['subagent','subagent_fork','send_message','interrupt_agent','list_agents','workflow'].includes(name))};
 if(role==='planner')return {planningOnly:true,readOnly:false,allow:['computer','computer_stop','oauth_setup','skill_mcp','read','glob','grep','skill','write','edit','hashline_read','ask_user_question','todo_write','scrum_report','workpool','session_read','session_search','memory_read','memory_search','web_search','fetch_content','get_search_content']};
 const readOnly=definition.readOnly===true||['planner','researcher','reviewer'].includes(role);
 return {readOnly,...(readOnly?{allow:['todo_write','workpool','ask_user_question','read','read_image','glob','grep','project_search','skill','scrum_report','ast_grep_search','ast_grep_scan','hashline_read','lsp_status','lsp_diagnostics','lsp_prepare_rename','lsp_goto_definition','lsp_find_references','lsp_symbols','session_list','session_info','session_read','session_search','memory_read','memory_search',...(['reviewer','plan-reviewer','explore'].includes(role)?[]:['web_search','fetch_content','get_search_content'])]}:{deny:['subagent','subagent_fork','send_message','interrupt_agent','list_agents','workflow']})};
}
