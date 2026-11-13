// Stand-in for Node's "path" in the browser (just enough for the report writer).
const join = (...a) => a.filter(Boolean).join("/").replace(/\/+/g, "/");
module.exports = { join, sep: "/", basename: p => String(p).split("/").pop(), relative: (a, b) => String(b).replace(String(a) + "/", ""), dirname: p => String(p).split("/").slice(0, -1).join("/") };
