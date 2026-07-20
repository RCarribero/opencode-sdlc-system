const fs = require("fs");
const path = require("path");
const f = path.join(process.cwd(), "install.js");
let c = fs.readFileSync(f, "utf8");

// Find the bug: replace `}\s*$/` with insert-before-last-brace
// The current code has: content.replace(/}\s*$/, `,\n    "plugin": [\n        "${p}"\n    ]\n}`)
// We need to insert BEFORE the last }, not replace it

c = c.replace(
  /content\.replace\(\/\}\s*\$\/`/,
  '// FIX: insert before last closing brace\n      content = content.replace(/\n'
);

c = c.replace(
  /`,\\\n    \\"plugin\\": \[\\n        \\"\\\$\{p\}\\"\\n    \]\\n}`\);/,
  '`;\n      content = content.slice(0, content.lastIndexOf("}")) + ",\\n    \\"plugin\\": [\\n        \\"" + p + "\\"\\n    ]\\n}" + content.slice(content.lastIndexOf("}"));'
);

fs.writeFileSync(f, c, "utf8");
console.log("OK");
