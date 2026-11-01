import { readFileSync, writeFileSync, mkdirSync, copyFileSync, realpathSync } from "node:fs";
import { resolve, dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const modules = resolve(option("--modules") ?? join(here, "../node_modules"));
const backup = option("--backup");
const dryRun = args.includes("--dry-run");
const runtimeOnly = args.includes("--runtime-only");
const compat = resolve(here, "../compat/rc3");
const manifest = JSON.parse(
  readFileSync(join(compat, "manifest.json"), "utf8"),
);
const hash = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const plans = [];

for (const name of [...new Set(manifest.map((entry) => entry.package))]) {
  const root = realpathSync(join(modules, name));
  const installed = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  );
  if (installed.version !== "0.2.1-rc.3")
    throw new Error(
      `Unsupported ${name} version ${installed.version}; no files changed`,
    );
  const variants = manifest.filter((entry) => entry.package === name);
  const selected = variants
    .map((entry) => ({
      ...entry,
      files: entry.files.filter(
        (file) => !runtimeOnly || file.file.endsWith(".js"),
      ),
    }))
    .find((entry) =>
      entry.files.every((file) =>
        [file.before, file.after].includes(hash(join(root, file.file))),
      ),
    );
  if (!selected)
    throw new Error(`Unrecognized ${name} bytes; no files changed`);
  if (
    selected.files.every((file) => hash(join(root, file.file)) === file.after)
  ) {
    console.log(`${name}: compatible (${selected.variant})`);
    continue;
  }
  if (
    !selected.files.every((file) => hash(join(root, file.file)) === file.before)
  )
    throw new Error(
      `Mixed ${name} patch state; restore its backup before retrying`,
    );
  const patch = join(
    compat,
    runtimeOnly ? selected.runtimePatch : selected.patch,
  );
  execFileSync(
    "git",
    ["apply", "--check", "--unsafe-paths", `--directory=${root}`, patch],
    { cwd: parse(root).root, stdio: "pipe" },
  );
  plans.push({ ...selected, root, patch });
}
if (dryRun) {
  console.log(
    `Preflight passed for ${plans.length} native package patches; no files changed.`,
  );
  process.exit(0);
}
if (plans.length && !backup)
  throw new Error(
    "Pass an explicit --backup directory before applying native changes",
  );
const saved = [];
try {
  for (const plan of plans)
    for (const file of plan.files) {
      const target = join(plan.root, file.file);
      if (hash(target) !== file.before)
        throw new Error(`Native file changed after preflight: ${target}`);
      const destination = resolve(backup, plan.package, file.file);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(target, destination);
      saved.push({
        target,
        destination,
        before: file.before,
        after: file.after,
      });
    }
  for (const plan of plans) {
    execFileSync(
      "git",
      ["apply", "--unsafe-paths", `--directory=${plan.root}`, plan.patch],
      { cwd: parse(plan.root).root, stdio: "pipe" },
    );
    for (const file of plan.files)
      if (hash(join(plan.root, file.file)) !== file.after)
        throw new Error(`Post-patch hash mismatch: ${file.file}`);
    console.log(
      `${plan.package}: patched ${plan.files.length} files (${plan.variant})`,
    );
  }
  if (saved.length)
    writeFileSync(
      resolve(backup, "native-compat.json"),
      JSON.stringify(saved, null, 2) + "\n",
    );
} catch (error) {
  for (const file of saved) copyFileSync(file.destination, file.target);
  throw error;
}
