#!/usr/bin/env node
/**
 * OriCMS Setup Script
 *
 * One-command setup for local development.
 * Checks prerequisites, starts Postgres, copies env files, builds, migrates.
 *
 * Usage:
 *   node scripts/setup.mjs
 *   node scripts/setup.mjs --skip-docker    # if you already have Postgres running
 *   node scripts/setup.mjs --reset-db       # wipe and recreate the database
 */

import { spawn } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { createInterface } from "node:readline";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";

const args = new Set(process.argv.slice(2));
const SKIP_DOCKER = args.has("--skip-docker");
const RESET_DB = args.has("--reset-db");

// Detect available docker compose command (v2 plugin vs legacy)
const DOCKER_COMPOSE = await (async () => {
  try {
    await run("docker", ["compose", "version"], { silent: true, ignoreError: false });
    return ["docker", "compose"];
  } catch {
    return ["docker-compose"];
  }
})();

function log(msg) {
  console.log(msg);
}

function info(msg) {
  console.log(`${CYAN}→${RESET} ${msg}`);
}

function success(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

function warn(msg) {
  console.log(`${YELLOW}⚠${RESET} ${msg}`);
}

function error(msg) {
  console.log(`${RED}✗${RESET} ${msg}`);
}

function step(n, total, msg) {
  console.log(`\n${BOLD}[${n}/${total}]${RESET} ${msg}`);
}

function run(cmd, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: opts.silent ? "pipe" : "inherit",
      shell: opts.shell ?? false,
      env: { ...process.env, ...opts.env },
      cwd: opts.cwd,
    });

    let stdout = "";
    let stderr = "";

    if (opts.silent) {
      child.stdout?.on("data", (d) => {
        stdout += d.toString();
      });
      child.stderr?.on("data", (d) => {
        stderr += d.toString();
      });
    }

    child.on("close", (code) => {
      if (code !== 0 && !opts.ignoreError) {
        reject(new Error(`Command failed: ${cmd} ${args.join(" ")}`));
      } else {
        resolve({ code, stdout, stderr });
      }
    });

    child.on("error", reject);
  });
}

async function checkNode() {
  const version = process.version;
  const major = parseInt(version.slice(1).split(".")[0], 10);
  if (major < 20) {
    error(`Node.js ${version} is too old. Need 20+.`);
    process.exit(1);
  }
  success(`Node.js ${version}`);
}

async function checkNpm() {
  try {
    const { stdout } = await run("npm", ["--version"], { silent: true });
    const version = stdout.trim();
    const major = parseInt(version.split(".")[0], 10);
    if (major < 10) {
      error(`npm ${version} is too old. Need 10+.`);
      process.exit(1);
    }
    success(`npm ${version}`);
  } catch {
    error("npm not found");
    process.exit(1);
  }
}

async function checkDocker() {
  if (SKIP_DOCKER) {
    info("Skipping Docker check (--skip-docker)");
    return;
  }

  try {
    const { stdout } = await run("docker", ["info"], { silent: true });
    success("Docker is running");
  } catch {
    error("Docker is not running");
    log("");
    log("  Please start Docker Desktop and try again.");
    log("  Or, if you already have Postgres running locally, use:");
    log(`  ${DIM}node scripts/setup.mjs --skip-docker${RESET}`);
    log("");
    process.exit(1);
  }
}

async function checkGit() {
  try {
    const { stdout } = await run("git", ["--version"], { silent: true });
    success(stdout.trim());
  } catch {
    warn("Git not found — required for OriCMS features");
  }
}

async function installDeps() {
  info("Installing dependencies (this may take a minute)...");
  await run("npm", ["install"]);
  success("Dependencies installed");
}

async function copyEnvFiles() {
  let created = 0;

  if (!existsSync(".env")) {
    copyFileSync(".env.example", ".env");
    created++;
    success("Created .env from .env.example");
  } else {
    info(".env already exists, skipping");
  }

  if (!existsSync("packages/api/.env")) {
    copyFileSync("packages/api/.env.example", "packages/api/.env");
    created++;
    success("Created packages/api/.env from .env.example");
  } else {
    info("packages/api/.env already exists, skipping");
  }

  if (created > 0) {
    // Generate a valid 64-character hex encryption key for local dev
    const crypto = await import("node:crypto");
    const devKey = crypto.randomBytes(32).toString("hex");

    for (const envPath of [".env", "packages/api/.env"]) {
      if (!existsSync(envPath)) continue;
      let content = (await import("node:fs")).readFileSync(envPath, "utf-8");
      content = content.replace(
        /ENCRYPTION_KEY=REPLACE_ME_64_HEX_CHARS_REQUIRED_FOR_DEVELOPMENT_ONLY/g,
        `ENCRYPTION_KEY=${devKey}`
      );
      (await import("node:fs")).writeFileSync(envPath, content);
    }

    warn("Please review the generated .env files and set secure secrets before deploying.");
  }
}

function isValidHexKey(key, length) {
  return typeof key === "string" && key.length === length && /^[0-9a-fA-F]+$/.test(key);
}

async function validateEnvFiles() {
  const rootEnvPath = ".env";
  const apiEnvPath = "packages/api/.env";

  for (const envPath of [rootEnvPath, apiEnvPath]) {
    if (!existsSync(envPath)) continue;

    const content = (await import("node:fs")).readFileSync(envPath, "utf-8");
    const lines = content.split("\n");
    const vars = {};
    for (const line of lines) {
      const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (match) vars[match[1]] = match[2];
    }

    const jwt = vars.JWT_SECRET;
    if (!jwt || jwt.length < 32 || jwt.includes("change") || jwt.includes("your-")) {
      warn(`${envPath}: JWT_SECRET is missing or looks like a placeholder`);
    }

    const enc = vars.ENCRYPTION_KEY;
    if (!isValidHexKey(enc, 64)) {
      warn(`${envPath}: ENCRYPTION_KEY is missing or not a 64-character hex string`);
    }
  }
}

async function startPostgres() {
  if (SKIP_DOCKER) {
    info("Skipping Postgres startup (--skip-docker)");
    return;
  }

  info("Starting Postgres via Docker...");

  // Check for existing container from a previous run or different worktree
  try {
    const { stdout } = await run(
      "docker",
      ["ps", "-a", "--filter", "name=^/oricms-postgres$", "--format", "{{.Names}}"],
      { silent: true, ignoreError: true }
    );
    if (stdout.trim() === "oricms-postgres") {
      const { stdout: status } = await run(
        "docker",
        ["inspect", "--format", "{{.State.Status}}", "oricms-postgres"],
        { silent: true }
      );
      if (status.trim() === "running" && !RESET_DB) {
        info("Existing oricms-postgres container is already running; reusing it");
        success("Postgres is ready");
        return;
      }
      info("Removing existing oricms-postgres container...");
      await run("docker", ["rm", "-f", "oricms-postgres"], { silent: true, ignoreError: true });
    }
  } catch {
    // ignore — proceed to normal startup
  }

  if (RESET_DB) {
    info("Removing existing database container (--reset-db)...");
    try {
      await run("docker", ["rm", "-f", "oricms-postgres"], { silent: true, ignoreError: true });
    } catch {
      // ignore
    }
  }

  await run(DOCKER_COMPOSE[0], [...DOCKER_COMPOSE.slice(1), "up", "-d", "postgres"]);

  // Wait for Postgres to be ready
  info("Waiting for Postgres to be ready...");
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    try {
      await run(
        "docker",
        ["exec", "oricms-postgres", "pg_isready", "-U", "oricms", "-d", "oricms"],
        { silent: true }
      );
      success("Postgres is ready");
      return;
    } catch {
      attempts++;
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  error("Postgres failed to start within 30 seconds");
  process.exit(1);
}

async function buildShared() {
  info("Building @ori/shared...");
  await run("npm", ["run", "build", "-w", "@ori/shared"]);
  success("@ori/shared built");
}

async function generatePrisma() {
  info("Generating Prisma client...");
  await run("npm", ["run", "db:generate", "-w", "@ori/api"], {
    env: { PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
  success("Prisma client generated");
}

async function runMigrations() {
  info("Running database migrations...");
  await run("npm", ["run", "db:migrate", "-w", "@ori/api"], {
    env: { PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
  success("Migrations complete");
}

async function verifyMigrations() {
  info("Verifying migrations...");
  try {
    await run("npm", ["run", "db:verify-migrations", "-w", "@ori/api"]);
    success("Migrations verified");
  } catch (err) {
    error("Migration verification failed");
    log("");
    log("  This usually means the Postgres admin credentials are incorrect.");
    log("  The verification script needs superuser access to create and drop");
    log("  a temporary database to validate migration integrity.");
    log("");
    log("  Check that POSTGRES_ADMIN_URL in your .env files points to the");
    log("  'postgres' database with valid superuser credentials:");
    log(`  ${DIM}  POSTGRES_ADMIN_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres${RESET}`);
    log("");
    log("  If you just created a fresh .env, the container may have been");
    log("  initialized with a different password. Remove it and retry:");
    log(`  ${DIM}  docker rm -f oricms-postgres${RESET}`);
    log(`  ${DIM}  node scripts/setup.mjs${RESET}`);
    log("");
    process.exit(1);
  }
}

async function main() {
  log(`${BOLD}OriCMS Setup${RESET}\n`);

  const TOTAL_STEPS = 8;
  let currentStep = 0;

  step(++currentStep, TOTAL_STEPS, "Checking prerequisites");
  await checkNode();
  await checkNpm();
  await checkDocker();
  await checkGit();

  step(++currentStep, TOTAL_STEPS, "Installing dependencies");
  await installDeps();

  step(++currentStep, TOTAL_STEPS, "Copying environment files");
  await copyEnvFiles();
  await validateEnvFiles();

  step(++currentStep, TOTAL_STEPS, "Starting Postgres");
  await startPostgres();

  step(++currentStep, TOTAL_STEPS, "Building shared package");
  await buildShared();

  step(++currentStep, TOTAL_STEPS, "Generating Prisma client");
  await generatePrisma();

  step(++currentStep, TOTAL_STEPS, "Running migrations");
  await runMigrations();

  step(++currentStep, TOTAL_STEPS, "Verifying setup");
  await verifyMigrations();

  log("");
  log(`${GREEN}${BOLD}✓ OriCMS is ready!${RESET}\n`);
  log(`  Start the dev server:`);
  log(`  ${DIM}  npm run dev${RESET}\n`);
  log(`  Then open:`);
  log(`  ${DIM}  http://localhost:5173${RESET}  (admin app)`);
  log(`  ${DIM}  http://localhost:3001${RESET}  (API)`);
  log("");
}

main().catch((err) => {
  error(err.message || String(err));
  process.exit(1);
});
