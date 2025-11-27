// sync-env.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const workspaceDir = path.join(process.cwd(), "workspace");
const rootEnv = path.join(process.cwd(), ".env");
const workspaceEnv = path.join(workspaceDir, ".env");
const workspaceEnvLocal = path.join(workspaceDir, ".env.local");

// --- 1️⃣ Load workspace .env.local or .env ---
let envSource = "";
if (fs.existsSync(workspaceEnvLocal)) {
  dotenv.config({ path: workspaceEnvLocal });
  envSource = workspaceEnvLocal;
} else if (fs.existsSync(workspaceEnv)) {
  dotenv.config({ path: workspaceEnv });
  envSource = workspaceEnv;
} else {
  console.warn(`⚠️ Missing both .env and .env.local inside ${workspaceDir}`);
}

// --- 2️⃣ Mirror workspace/.env to workspace/.env.local (if missing) ---
if (fs.existsSync(workspaceEnv)) {
  if (!fs.existsSync(workspaceEnvLocal)) {
    fs.copyFileSync(workspaceEnv, workspaceEnvLocal);
    console.log(`✅ Created .env.local from .env in ${workspaceDir}`);
  }
} else if (fs.existsSync(workspaceEnvLocal)) {
  if (!fs.existsSync(workspaceEnv)) {
    fs.copyFileSync(workspaceEnvLocal, workspaceEnv);
    console.log(`✅ Created .env from .env.local in ${workspaceDir}`);
  }
}

// --- 3️⃣ Mirror workspace/.env to root for Vercel builds ---
if (fs.existsSync(workspaceEnv)) {
  fs.copyFileSync(workspaceEnv, rootEnv);
  console.log(`✅ Mirrored ${workspaceEnv} → ${rootEnv} for Vercel builds`);
} else if (fs.existsSync(workspaceEnvLocal)) {
  fs.copyFileSync(workspaceEnvLocal, rootEnv);
  console.log(`✅ Mirrored ${workspaceEnvLocal} → ${rootEnv} for Vercel builds`);
}

// --- 4️⃣ Print Firebase env key chec
