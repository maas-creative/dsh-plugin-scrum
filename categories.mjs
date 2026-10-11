// Category names are compatible with OMO; all defaults honor the host's configured model.
export const categories={
 'visual-engineering':{role:'designer',skills:['frontend','visual-qa']},
 architect:{role:'architect',skills:[]},ultrabrain:{role:'architect',skills:[]},
 'deep-low':{role:'executor',skills:[]},'deep-high':{role:'executor',skills:[]},
 artistry:{role:'designer',skills:['frontend']},quick:{role:'executor',skills:[]},
 'unspecified-low':{role:'executor',skills:[]},'unspecified-high':{role:'executor',skills:[]},writing:{role:'writer',skills:[]}
};
export function routeTask(pick,custom={}){
 const category=pick.category;if(category&&!categories[category]&&!custom[category])throw Error('未定義の担当カテゴリです');
 const selected=category?(custom[category]||categories[category]):{};
 const skills=pick.load_skills??pick.skills??selected.skills??[];
 if(!Array.isArray(skills)||skills.some(s=>typeof s!=='string'||!s.trim()||s.length>100))throw Error('スキル名の配列を指定してください');
 return {...pick,category,role:pick.role||pick.subagent_type||selected.role||'executor',skills:[...new Set(skills)]};
}
