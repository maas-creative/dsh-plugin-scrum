// Conservative boundary filter. No matched secret value is returned by scanning.
const patterns=[
 /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[A-Z0-9]{16})\b/g,
 /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
 /\bBearer\s+[A-Za-z0-9_.~+\/-]{12,}=*/gi,
 /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*["']?\s*[:=]\s*["']?([^\s"',;}&]{8,})/gi,
 /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g
];
export function scanSecretLikeMaterial(text){const findings=[];for(let i=0;i<patterns.length;i++){const pattern=new RegExp(patterns[i].source,patterns[i].flags);for(const match of String(text).matchAll(pattern))findings.push({kind:'secret-pattern-'+i,start:match.index,end:match.index+match[0].length});}return findings;}
export function redactSecretLikeMaterial(text){let value=String(text);for(const pattern of patterns)value=value.replace(new RegExp(pattern.source,pattern.flags),'[REDACTED]');return value;}
export function redactUrl(input){try{const url=new URL(input);if(url.username)url.username='REDACTED';if(url.password)url.password='REDACTED';for(const key of url.searchParams.keys())if(/token|secret|password|key|code/i.test(key))url.searchParams.set(key,'REDACTED');return redactSecretLikeMaterial(url.toString());}catch{return redactSecretLikeMaterial(input);}}
