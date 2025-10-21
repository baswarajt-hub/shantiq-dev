// fix-datefns-imports.js
import fs from "fs";
import path from "path";

const targetFns = [
  "format",
  "parseISO",
  "isToday",
  "isFuture",
  "differenceInMinutes",
  "parse",
  "addMinutes",
  "subMinutes",
  "startOfDay",
  "max",
  "isBefore",
  "isAfter",
];

const root = process.cwd();

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !full.includes("node_modules")) walk(full);
    else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) fixFile(full);
  }
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  let modified = false;

  // Match patterns like import format from 'date-fns/format';
  for (const fn of targetFns) {
    const regex = new RegExp(`import\\s+${fn}\\s+from\\s+['"]date-fns/${fn}['"];?`, "g");
    if (regex.test(content)) {
      console.log(`✅ Fixed ${fn} import in ${filePath}`);
      content = content.replace(regex, "");
      // Add or merge into date-fns named import
      if (content.includes("from 'date-fns'")) {
        content = content.replace(/import\s*{([^}]*)}\s*from\s*['"]date-fns['"];/, (match, existing) => {
          const existingFns = existing.split(",").map(s => s.trim()).filter(Boolean);
          if (!existingFns.includes(fn)) existingFns.push(fn);
          return `import { ${existingFns.sort().join(", ")} } from 'date-fns';`;
        });
      } else {
        content = `import { ${fn} } from 'date-fns';\n` + content;
      }
      modified = true;
    }
  }

  if (modified) fs.writeFileSync(filePath, content, "utf-8");
}

console.log("🔍 Scanning project for invalid date-fns imports...");
walk(root);
console.log("🎉 Done! All date-fns imports have been normalized to named imports.");
