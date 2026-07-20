const fs = require("fs");
const f = "install.js";
let c = fs.readFileSync(f, "utf8");
// Replace the buggy 3 lines (133-135) with correct insert-before-last-brace logic
// Old: content.replace(/}\s*$/, `,\n    "plugin": [\n        "${p}"\n    ]\n}`)
// New: insert before last }
const old = c.slice(0);
// Find the exact block
const marker = 'content.replace(\n              /}\\s*$/,';
const idx = c.indexOf(marker);
if (idx > 0) {
  // Find the start of this expression line (previous line's else block)
  const lineStart = c.lastIndexOf('\n', idx - 2) + 1;
  // Find end of the replace call (the ); line)
  const endMarker = ');\n          }';
  const endIdx = c.indexOf(endMarker, idx);
  if (endIdx > 0) {
    const before = c.slice(0, lineStart);
    const after = c.slice(endIdx + endMarker.length);
    const fix = 'content = content.replace(\n' +
      '              /([\\s\\S]*)}\\s*$/,\n' +
      '              (match, before) => before + \',\\n    "plugin": [\\n        "\' + p + \'"\\n    ]\\n}\'\n' +
      '            );\n' +
      '          }';
    c = before + fix + after;
    fs.writeFileSync(f, c, "utf8");
    console.log("FIXED: replaced buggy plugin injection block");
  } else {
    console.log("ERROR: could not find end of buggy block");
  }
} else {
  console.log("WARN: bug pattern not found, file may already be fixed");
}
