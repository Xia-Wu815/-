#!/usr/bin/env node
/**
 * 发布前检查：扫描即将提交的文件是否含登录密钥或私有配置。
 * 用法：node scripts/check-publish.js
 * 若已 git init：node scripts/check-publish.js --staged
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

const FORBIDDEN_FILES = new Set([
  "auth.js",
  "oauth-bootstrap.js",
  ".env"
]);

const SECRET_PATTERNS = [
  { name: "Supabase 项目 URL", re: /https:\/\/[a-z0-9]+\.supabase\.co/i },
  { name: "Supabase publishable key", re: /sb_publishable_[A-Za-z0-9_]+/ },
  { name: "激活码 RPC", re: /xxj_activation_claim_by_qq/ }
];

const LOGIN_UI_PATTERNS = [
  { name: "登录弹层", re: /id="auth-overlay"/ },
  { name: "激活码页", re: /id="activation"/ },
  { name: "Discord 登录按钮", re: /id="auth-discord"/ }
];

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "scripts"
]);

function listTrackedOrAll(useStaged) {
  if (useStaged) {
    try {
      const out = execSync("git diff --cached --name-only --diff-filter=ACM", {
        cwd: ROOT,
        encoding: "utf8"
      }).trim();
      return out ? out.split(/\r?\n/).filter(Boolean) : [];
    } catch {
      console.error("未检测到 git 仓库，或无法读取 staged 文件。");
      process.exit(1);
    }
  }
  const files = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (IGNORE_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      const rel = path.relative(ROOT, full).replace(/\\/g, "/");
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else files.push(rel);
    }
  }
  walk(ROOT);
  return files;
}

function main() {
  const useStaged = process.argv.includes("--staged");
  const files = listTrackedOrAll(useStaged);
  const errors = [];

  for (const rel of files) {
    const base = path.basename(rel);
    if (FORBIDDEN_FILES.has(base) || FORBIDDEN_FILES.has(rel)) {
      if (useStaged) errors.push(`禁止提交的文件：${rel}`);
      continue;
    }
    if (!/\.(js|html|css|json|md|mdc|webmanifest|ps1|sh)$/i.test(rel)) continue;
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, "utf8");
    const skipSecretScan = rel === "scripts/check-publish.js";
    for (const { name, re } of SECRET_PATTERNS) {
      if (skipSecretScan) continue;
      if (re.test(text)) {
        errors.push(`${rel}：疑似含 ${name}`);
      }
    }
    if (rel === "index.html") {
      for (const { name, re } of LOGIN_UI_PATTERNS) {
        if (re.test(text)) {
          errors.push(`${rel}：不应含登录界面 ${name}`);
        }
      }
    }
  }

  const missingStubs = ["auth.stub.js", "oauth-bootstrap.stub.js"].filter(
    (f) => !fs.existsSync(path.join(ROOT, f))
  );
  for (const f of missingStubs) {
    errors.push(`缺少公开占位文件：${f}`);
  }

  if (errors.length) {
    console.error("发布检查未通过：\n");
    for (const e of errors) console.error("  • " + e);
    console.error("\n请确认 .gitignore 已排除 auth.js / oauth-bootstrap.js，并清理敏感内容后再提交。");
    process.exit(1);
  }

  console.log(`发布检查通过（${files.length} 个文件，${useStaged ? "仅 staged" : "全目录"}）。`);
}

main();
