// Minimal posix `path` for the in-browser engine.
const norm = (p: string) => {
  const out: string[] = [];
  for (const s of p.split("/")) {
    if (!s || s === ".") continue;
    if (s === "..") out.pop();
    else out.push(s);
  }
  return "/" + out.join("/");
};
export const join = (...p: string[]) => norm(p.filter(Boolean).join("/"));
export const resolve = join;
export const basename = (p: string) => p.split("/").filter(Boolean).pop() ?? "";
export const extname = (p: string) => {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i > 0 ? b.slice(i) : "";
};
export const dirname = (p: string) => norm(p.split("/").slice(0, -1).join("/"));
export const sep = "/";
export default { join, resolve, basename, extname, dirname, sep };
