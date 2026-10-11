import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';

const inside = (root, candidate) => {
  const suffix = relative(root,candidate);
  return suffix === '' || (!suffix.startsWith('..'+sep) && suffix !== '..' && !isAbsolute(suffix));
};

// Called after the filesystem host resolves symlinks, including immediately
// before each read/write. A string prefix alone is not an identity boundary.
export function registerMemoryFilesystemPolicy(host, {identityPaths, durableRoot}) {
  if (!identityPaths?.root || !durableRoot) throw Error('Memory identity and durable roots are required');
  const allowed = [...new Set([identityPaths.root,durableRoot].map(root=>resolve(root)))];
  const families = [...new Set(allowed.map(root=>dirname(root)))];
  const policy = {
    deniedRoots:families,
    check({canonicalPath,operation}) {
      if (typeof canonicalPath !== 'string' || !isAbsolute(canonicalPath)) return {allow:false,reason:'Canonical absolute path required for memory access'};
      const path = resolve(canonicalPath);
      if (allowed.some(root=>inside(root,path))) return {allow:true};
      if (families.some(root=>inside(root,path))) return {allow:false,reason:`cross-identity memory access denied: ${operation} ${path}`};
      return {allow:true};
    },
  };
  host.registerFilesystemPolicy(policy);
  return policy;
}
