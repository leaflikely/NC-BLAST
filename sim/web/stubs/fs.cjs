// Stand-in for Node's "fs" in the browser: files "written" are kept in memory so the page can offer them.
const files = new Map();
module.exports = {
  files,
  writeFileSync(p, data) { files.set(String(p), String(data)); },
  mkdirSync() {},
  existsSync(p) { return files.has(String(p)); },
  readFileSync(p) { return files.get(String(p)) || ""; },
};
