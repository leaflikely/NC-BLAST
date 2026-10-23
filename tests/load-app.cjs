// Shared helper for the tests. The app is split into several script files (see index.html).
// This reads them in the same order the browser loads them and returns them as ONE block of
// text, with Windows line endings turned into plain ones, so tests can search it as before.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const PARTS = ["blade-images.js", "core.js", "screens.js", "judge-match.js", "organizer.js", "app.js"];
const plain = s => s.replace(/\r\n/g, "\n");
function loadText(file) { return plain(fs.readFileSync(path.join(root, file), "utf8")); }
function loadApp() { return PARTS.map(loadText).join("\n"); }
module.exports = { root, PARTS, loadText, loadApp };
