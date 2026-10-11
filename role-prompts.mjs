// Compatibility identifiers remain stable for saved sessions and user configuration.
export const roleAliases={oracle:'architect',metis:'plan-consultant',momus:'plan-reviewer','sisyphus-junior':'executor',prometheus:'planner','omo-senpi-code-reviewer':'omo-native-code-reviewer','omo-senpi-qa-executor':'omo-native-qa-executor','omo-senpi-gate-reviewer':'omo-native-gate-reviewer'};
const definitions={
 sisyphus:['統括','依頼の完成条件を整理し、担当の結果を成果物と照合する。残作業を明示して次の作業へ進める。'],
 atlas:['実行統括','依存関係に沿って計画を実行する。担当の終了と依頼全体の完了を区別する。'],
 hephaestus:['自律実行','既存構造を調べ、必要な変更を実装する。実行結果と回帰試験で完成条件を確認する。'],
 'multimodal-looker':['画像・文書分析','与えられた画像と文書を観察し、質問に関係する事実と判読できない箇所を報告する。',true],
 'omo-native-code-reviewer':['コード審査','変更と呼び出し元を照合し、再現条件と修正箇所を示す。実装ファイルを変更しない。',true],
 'omo-native-qa-executor':['受入試験','指定シナリオを実行し、実際の結果、証拠、未実施事項を報告する。'],
 'omo-native-gate-reviewer':['完了審査','完成条件ごとに実装と検証証拠を確認する。未達条件があれば完了として承認しない。',true]
};
// Export names are retained as API compatibility, not as a statement of provenance.
export const upstreamRoles=Object.fromEntries(Object.entries(definitions).map(([id,[name,instruction,readOnly=false]])=>[id,{name,instruction,readOnly}]));
export function upstreamRolePrompt(role,{agents=[],tools=[],skills=[],categories=[]}={}){
 const instruction=upstreamRoles[roleAliases[role]||role]?.instruction;
 if(!instruction)return undefined;
 const inventory=Object.entries({agents,tools,skills,categories}).filter(([,items])=>items.length).map(([kind,items])=>kind+': '+items.map(item=>typeof item==='string'?item:item.name||item.id).filter(Boolean).join(', '));
 return instruction+(inventory.length?'\nAvailable session resources (subject to permissions):\n'+inventory.join('\n'):'');
}
export const scrumRoleContract=`Scrum execution requirements:
Use the tools available in this session and follow the user's authorization and file ownership boundaries.
Execution uses GPT 6.1 Sol with low reasoning; role instructions do not override model settings.
For delegated tasks, record the task ID, requested output and acceptance criteria. Retrieve the report, inspect the output, and record acceptance through scrum_review. A report alone does not prove completion or submission.
When delegation is prohibited, perform the authorized work directly.
Report failed checks and remaining work accurately. Continue until the assigned acceptance criteria are satisfied or a concrete external blocker requires user action.
Read-only roles may inspect and submit their assigned report, but must not change implementation files. Planning roles may write plans under .omo/plans or .omo/drafts; those legacy paths remain for existing sessions.`;
