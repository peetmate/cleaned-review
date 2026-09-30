#!/usr/bin/env node
/* File workshop feedback as GitHub issues, from a JSON export of the mockup's feedback store.
 *
 * Why a script and not a button: a static page cannot hold a GitHub token. Anything shipped
 * to the browser is public, and a token that can open issues can also close them and read
 * private repositories. This runs on the facilitator's machine and borrows their gh CLI
 * credentials, so nothing secret is ever published.
 *
 *   node tools/file_feedback_issues.mjs icleaned-feedback-workshop-2026-10.json
 *   node tools/file_feedback_issues.mjs export.json --dry-run
 *   node tools/file_feedback_issues.mjs export.json --repo owner/name --min-severity 2
 *
 * Idempotent: every issue body carries "<!-- fb-id: … -->" and the script searches for it
 * before creating, so re-running after a partial failure files only what is missing.
 * Screengrabs cannot be attached by the CLI; they are written next to the export and the
 * issue says which file to drag in.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, join } from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const flag = (name, dflt) => { const i = args.indexOf("--" + name); return i === -1 ? dflt : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
const DRY = !!flag("dry-run", false);
const REPO = String(flag("repo", "peetmate/cleaned-review"));
const MIN_SEV = Number(flag("min-severity", 0)) || 0;
const LABEL = "workshop-feedback";

if (!file) {
  console.error("Usage: node tools/file_feedback_issues.mjs <export.json> [--repo owner/name] [--min-severity 1|2|3] [--dry-run]");
  process.exit(2);
}

const gh = (a, opts) => execFileSync("gh", a, { encoding: "utf8", stdio: opts && opts.quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"] }).trim();

// The same wording the mockup uses, so an issue filed by hand and one filed here match.
const TYPE_WORD = { confusing: "confusing", missing: "missing", wrong_unit: "wrong unit or value", love_it: "works well", dont_need: "not needed", bug: "bug" };
const SEV_WORD = { 3: "blocker", 2: "high", 1: "low" };
const title = (d) => { const t = `[mockup] ${d.fbLabel || d.screen || "mockup"}: ${(d.text || "").replace(/\s+/g, " ").trim()}`; return t.length > 110 ? t.slice(0, 107) + "…" : t; };
const body = (d, shotFile) => {
  const L = [d.text || "(no text)", "", "| | |", "|---|---|", `| Screen | ${d.screen || "?"} |`];
  if (d.fbLabel) L.push(`| Element | ${d.fbLabel} |`);
  if (d.fieldId) L.push(`| Field | \`${d.fieldId}\` |`);
  if ((d.types || []).length) L.push(`| Kind | ${d.types.map((t) => TYPE_WORD[t] || t).join(", ")} |`);
  if (d.severity) L.push(`| Severity | ${SEV_WORD[d.severity] || d.severity} |`);
  if (d.group) L.push(`| Group | ${d.group} |`);
  if (d.viewerLabel) L.push(`| Reported by | ${d.viewerLabel} |`);
  L.push(`| Session | ${d.session || "?"} |`, `| Build | ${d.appVersion || "?"} |`);
  if (d.viewport) L.push(`| Viewport | ${d.viewport.w}×${d.viewport.h}${d.theme ? ", " + d.theme : ""} |`);
  L.push("");
  if (shotFile) L.push(`A screengrab was taken: \`${shotFile}\`. Drag it into this issue — the CLI cannot attach images.`);
  else if (d.screenshotNote) L.push(`A screengrab was taken but dropped before saving (${d.screenshotNote}).`);
  L.push("", `<!-- fb-id: ${d.id} -->`);
  return L.join("\n");
};

const dump = JSON.parse(readFileSync(file, "utf8"));
const docs = (dump.feedback || []).filter((d) => (Number(d.severity) || 0) >= MIN_SEV);
if (!docs.length) { console.log(`Nothing to file from ${basename(file)} at severity >= ${MIN_SEV}.`); process.exit(0); }

// screengrabs out to files beside the export, referenced from the issue
const shotDir = join(dirname(file), basename(file).replace(/\.json$/, "") + "-screengrabs");
const shots = {};
for (const d of docs) {
  if (typeof d.screenshot !== "string" || !d.screenshot.startsWith("data:image/")) continue;
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(d.screenshot);
  if (!m) continue;
  if (!DRY) { if (!existsSync(shotDir)) mkdirSync(shotDir, { recursive: true }); writeFileSync(join(shotDir, `${d.id}.${m[1] === "jpeg" ? "jpg" : m[1]}`), Buffer.from(m[2], "base64")); }
  shots[d.id] = join(basename(shotDir), `${d.id}.${m[1] === "jpeg" ? "jpg" : m[1]}`);
}

if (!DRY) {
  try { gh(["label", "create", LABEL, "--repo", REPO, "--description", "Reported from the redesign mockup", "--color", "0E8A16"], { quiet: true }); console.log(`label "${LABEL}" created`); }
  catch { /* already there */ }
}

let filed = 0, skipped = 0, failed = 0;
for (const d of docs) {
  let already = "";
  try { already = gh(["issue", "list", "--repo", REPO, "--state", "all", "--search", `"fb-id: ${d.id}" in:body`, "--json", "number", "--jq", ".[0].number // empty"], { quiet: true }); }
  catch { already = ""; }
  if (already) { console.log(`· already filed as #${already}: ${title(d).slice(0, 70)}`); skipped++; continue; }

  const labels = [LABEL, ...((d.types || []).includes("bug") ? ["bug"] : []), ...(d.severity === 3 ? [] : [])];
  if (DRY) { console.log(`would file: ${title(d)}\n  labels: ${labels.join(", ")}${shots[d.id] ? `\n  screengrab: ${shots[d.id]}` : ""}`); filed++; continue; }
  try {
    const url = gh(["issue", "create", "--repo", REPO, "--title", title(d), "--body", body(d, shots[d.id]), "--label", labels.join(",")], { quiet: true });
    console.log(`+ ${url}`);
    filed++;
  } catch (e) { console.error(`! failed: ${title(d).slice(0, 70)}\n  ${String(e.message || e).split("\n")[0]}`); failed++; }
}

console.log(`\n${DRY ? "Would file" : "Filed"} ${filed}, skipped ${skipped} already present${failed ? `, ${failed} failed` : ""}.`);
if (Object.keys(shots).length && !DRY) console.log(`Screengrabs written to ${shotDir} — drag them into the issues that name them.`);
