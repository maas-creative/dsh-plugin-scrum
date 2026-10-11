/** Independent Bun/Hono project scaffold; also runs with Node type stripping. */
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

export function createProject(name: string, parent: string = "."): string {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) throw new Error("Use a simple project name");
  const directory = resolve(parent);
  if (!statSync(directory).isDirectory()) throw new Error("A parent directory is required");
  const target = join(directory, name);
  mkdirSync(target, { mode: 0o700 });
  mkdirSync(join(target, "src"));
  const json = (path: string, value: unknown) => writeFileSync(join(target, path), JSON.stringify(value, null, 2).replace(/\[\n\s+("(?:[^"\\]|\\.)*")\n\s*\]/g, "[$1]") + "\n", { flag: "wx", mode: 0o600 });
  json("package.json", {
    name: name.toLowerCase(), version: "0.0.1", private: true, type: "module",
    scripts: { dev: "bun --hot src/index.ts", start: "bun src/index.ts", check: "bunx biome check . && bunx tsc --noEmit && bun test", "check:fix": "bunx biome check --write .", test: "bun test" },
    dependencies: { hono: "^4.12.5", zod: "^3.24.0" },
    devDependencies: { "@biomejs/biome": "^1.9.0", "@types/bun": "latest", typescript: "^5.8.0" },
  });
  json("tsconfig.json", { compilerOptions: { target: "ESNext", module: "ESNext", moduleResolution: "Bundler", lib: ["ESNext"], types: ["bun"], strict: true, noEmit: true, noUncheckedIndexedAccess: true, noUnusedLocals: true, noUnusedParameters: true, skipLibCheck: true }, include: ["src/**/*.ts"] });
  json("biome.json", { $schema: "https://biomejs.dev/schemas/1.9.4/schema.json", formatter: { indentStyle: "space", indentWidth: 2, lineWidth: 100 }, organizeImports: { enabled: true }, linter: { rules: { recommended: true } } });
  const source = `import { Hono } from "hono";
import { z } from "zod";

export const app = new Hono();
const payload = z.object({ message: z.string().min(1) });
app.get("/health", (c) => c.json({ status: "ok" }));
app.post("/echo", async (c) => {
  const parsed = payload.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid payload" }, 400);
  return c.json(parsed.data);
});

export default {
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};
`;
  const tests = `import { describe, expect, test } from "bun:test";
import { app } from "./index";

describe("HTTP service", () => {
  test("returns health", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
  test("rejects malformed input", async () => {
    const response = await app.request("/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    expect(response.status).toBe(400);
  });
  test("returns validated input", async () => {
    const response = await app.request("/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "fixture" }),
    });
    expect(await response.json()).toEqual({ message: "fixture" });
  });
});
`;
  const files: Array<[string, string]> = [["src/index.ts", source], ["src/index.test.ts", tests], [".gitignore", "node_modules/\n.env\ncoverage/\n"]];
  for (const [file, body] of files) {
    writeFileSync(join(target, file), body, { flag: "wx", mode: 0o600 });
  }
  return target;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { values, positionals } = parseArgs({ options: { path: { type: "string", default: "." }, help: { type: "boolean", short: "h", default: false } }, allowPositionals: true, strict: true });
  if (values.help) console.log("Usage: node new-project.ts NAME [--path PARENT]");
  else {
    const name = positionals[0];
    if (positionals.length !== 1 || name === undefined) throw new Error("Exactly one project name is required");
    console.log(createProject(name, values.path));
  }
}
