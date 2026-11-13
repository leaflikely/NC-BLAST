// Builds robots/bundle.js (the robot judges as one browser file) from the simulator files.
// Needs esbuild:  npm install --no-save esbuild   then   node sim/web/build.cjs
const path = require("path");
require("esbuild").build({
  entryPoints: [path.join(__dirname, "main.cjs")],
  bundle: true, platform: "browser", format: "iife", target: "es2022", logLevel: "info",
  outfile: path.join(__dirname, "..", "..", "robots", "bundle.js"),
  alias: { fs: path.join(__dirname, "stubs", "fs.cjs"), path: path.join(__dirname, "stubs", "path.cjs") },
}).catch(() => process.exit(1));
