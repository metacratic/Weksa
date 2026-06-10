#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const fixtureRoot = resolve(repoRoot, "examples/persona-lowering/metame-casual-pre2025");
const voidbotRoot = resolve("E:/Projects/VoidBot");
const culturalStackPath = resolve(fixtureRoot, "metame-cultural-stack.yaml");
const cultureProfilePaths = [
  "data/cultural-ontology/cultures/dutch-american-diaspora.yaml",
  "data/cultural-ontology/cultures/western-europe-maritime-childhood.yaml",
  "data/cultural-ontology/cultures/portugal-resident-algarve-lisbon.yaml",
  "data/cultural-ontology/cultures/texas-houston-us-adolescence.yaml",
  "data/cultural-ontology/subcultures/online-game-dev-discord-pre2025.yaml",
  "data/cultural-ontology/subcultures/gamecult-open-source-crypto-anarchist.yaml",
];
const targetOverlayPath = resolve(repoRoot, "data/target-language-ontology/en-US-metacrat-casual-pre2025.yaml");

const args = new Set(process.argv.slice(2));
const real = args.has("--real");
const keepTemp = args.has("--keep-temp");
const itemFilter = readArg("--item");
const limit = Number(readArg("--limit") ?? "0");
const runId = readArg("--run-id") ?? new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = resolve(fixtureRoot, "runs", runId);

const fixture = await loadFixture();
const items = fixture.items
  .filter((item) => !itemFilter || item.id === itemFilter)
  .slice(0, limit > 0 ? limit : undefined);
const holdoutUtterances = fixture.items
  .map((item) => item.groundTruth)
  .filter((utterance) => utterance.trim().length > 0);

if (items.length === 0) {
  throw new Error(`No fixture items selected${itemFilter ? ` for --item ${itemFilter}` : ""}.`);
}

await mkdir(outputDir, { recursive: true });

const culturalStack = await readFile(culturalStackPath, "utf8");
const cultureProfiles = await Promise.all(cultureProfilePaths.map(async (path) => ({
  path,
  text: await readFile(resolve(repoRoot, path), "utf8"),
})));
const targetOverlay = await readFile(targetOverlayPath, "utf8");
const personaPrompt = await readFile(resolve(fixtureRoot, "persona-interlingua-prompt.md"), "utf8");
const loweringPrompt = await readFile(resolve(fixtureRoot, "weksa-lowering-prompt.md"), "utf8");
const baseProjection = await assembleVoidBotPrompt({ itemId: "base" });
const projectedMemory = extractBetween(
  baseProjection.prompt,
  "What you remember, feel, and want right now:",
  "Known human pronoun guidance:",
).trim();

const runSummary = {
  schema_version: "weksa.persona_golf_run.v0",
  run_id: runId,
  mode: real ? "real" : "dry_run",
  fixture_id: "metame-casual-pre2025",
  target_overlay: "weksa.target_cultural_ontology.en-US.metacrat_casual_pre2025.v0",
  cultural_stack: "examples/persona-lowering/metame-casual-pre2025/metame-cultural-stack.yaml",
  items: [],
};

for (const item of items) {
  const itemDir = resolve(outputDir, item.id);
  await mkdir(itemDir, { recursive: true });
  const conversationSurface = renderConversationSurface(item);
  const memorySurface = renderTemporaryMemorySurface(projectedMemory, item);
  await writeFile(resolve(itemDir, "conversation-surface.md"), conversationSurface, "utf8");
  await writeFile(resolve(itemDir, "memory-surface.md"), memorySurface, "utf8");

  const assembled = await assembleVoidBotPrompt({
    itemId: item.id,
    memorySurfacePath: resolve(itemDir, "memory-surface.md"),
    conversationSurfacePath: resolve(itemDir, "conversation-surface.md"),
  });
  await writeFile(resolve(itemDir, "voidbot-assembled-prompt.md"), assembled.prompt, "utf8");

  const interlinguaRequest = [
    personaPrompt.trim(),
    "",
    "VoidBot assembled Persona prompt:",
    "```markdown",
    assembled.prompt,
    "```",
    "",
    "Fixture item without answer key:",
    "```yaml",
    renderItemForPrompt(item),
    "```",
  ].join("\n");
  await writeFile(resolve(itemDir, "persona-interlingua-request.md"), interlinguaRequest, "utf8");

  const interlingua = real
    ? await runCodex(interlinguaRequest, { job: `persona-interlingua:${item.id}` })
    : renderDryRunInterlingua(item);
  await writeFile(resolve(itemDir, "persona-interlingua.yaml"), interlingua.trim() + "\n", "utf8");

  const loweringRequest = [
    loweringPrompt.trim(),
    "",
    "Projected Metame memory/context surface:",
    "```markdown",
    memorySurface,
    "```",
    "",
    "Metame Persona cultural stack reference:",
    "```yaml",
    culturalStack,
    "```",
    "",
    "Referenced Weksa culture/subculture profiles:",
    ...cultureProfiles.flatMap((profile) => [
      "",
      `# ${profile.path}`,
      "```yaml",
      redactHoldouts(profile.text, holdoutUtterances),
      "```",
    ]),
    "",
    "Target-language surface overlay:",
    "```yaml",
    redactHoldouts(targetOverlay, holdoutUtterances),
    "```",
    "",
    "Persona-produced interlingua:",
    "```yaml",
    interlingua,
    "```",
  ].join("\n");
  await writeFile(resolve(itemDir, "weksa-lowering-request.md"), loweringRequest, "utf8");

  const lowered = real
    ? await runCodex(loweringRequest, { job: `weksa-lowering:${item.id}` })
    : renderDryRunLowering(item);
  await writeFile(resolve(itemDir, "weksa-lowered-output.yaml"), lowered.trim() + "\n", "utf8");

  const spokenText = extractSpokenText(lowered);
  const score = scoreText(spokenText, item.groundTruth);
  const evaluation = renderEvaluation(item, spokenText, score);
  await writeFile(resolve(itemDir, "evaluation.yaml"), evaluation, "utf8");
  runSummary.items.push({
    id: item.id,
    spoken_text: spokenText,
    ground_truth: item.groundTruth,
    token_f1: Number(score.f1.toFixed(3)),
    exact_normalized: score.exact,
  });
}

await writeFile(resolve(outputDir, "summary.json"), `${JSON.stringify(runSummary, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ok: true, outputDir, mode: runSummary.mode, items: runSummary.items }, null, 2)}\n`);

if (!keepTemp) {
  await rm(resolve(outputDir, "_tmp"), { recursive: true, force: true }).catch(() => undefined);
}

async function loadFixture() {
  const interlinguaText = await readFile(resolve(fixtureRoot, "interlingua.yaml"), "utf8");
  const groundTruthText = await readFile(resolve(fixtureRoot, "ground-truth.yaml"), "utf8");
  const itemIds = [...interlinguaText.matchAll(/^  - id: ([^\r\n]+)/gm)].map((match) => match[1].trim());
  return {
    items: itemIds.map((id) => {
      const interlinguaBlock = extractListItemBlock(interlinguaText, id);
      const groundBlock = extractListItemBlock(groundTruthText, id);
      return {
        id,
        interlinguaBlock,
        groundTruth: readYamlStringField(groundBlock, "utterance"),
        messageId: readYamlStringField(groundBlock, "message_id"),
        channelName: readYamlStringField(groundBlock, "channel_name"),
      };
    }),
  };
}

function extractListItemBlock(text, id) {
  const pattern = new RegExp(`^  - id: ${escapeRegExp(id)}\\r?\\n`, "m");
  const startMatch = pattern.exec(text);
  if (!startMatch) {
    throw new Error(`Could not find item ${id}.`);
  }
  const start = startMatch.index;
  const rest = text.slice(start + startMatch[0].length);
  const next = rest.search(/^  - id: /m);
  return text.slice(start, next >= 0 ? start + startMatch[0].length + next : text.length).trimEnd();
}

function readYamlStringField(block, key) {
  const quoted = new RegExp(`^    ${key}: "([\\s\\S]*?)"\\r?$`, "m").exec(block);
  if (quoted) {
    return quoted[1].replace(/\\"/g, "\"");
  }
  const plain = new RegExp(`^    ${key}: ([^\\r\\n]+)`, "m").exec(block);
  return plain ? plain[1].trim() : "";
}

function renderConversationSurface(item) {
  return [
    "Read this as the current fixture room, not as old archive trivia.",
    "The Persona should decide intent from this local scene. Do not reveal or infer the held-out answer key.",
    "",
    `Current fixture item: ${item.id}`,
    "```yaml",
    item.interlinguaBlock,
    "```",
  ].join("\n");
}

function renderTemporaryMemorySurface(projectedMemory, item) {
  return [
    projectedMemory,
    "",
    "Temporary fixture adjustment:",
    `- Treat the ${item.id} scene as the live room situation for this private harness turn.`,
    "- The goal is to produce interlingua intent for Weksa, not a final Discord line.",
    "- Keep pre-2025 casual room texture available: compact banter, quick self-deprecation, friendly status play, and casual turn-taking.",
  ].join("\n");
}

function renderItemForPrompt(item) {
  return item.interlinguaBlock;
}

async function assembleVoidBotPrompt({ itemId, memorySurfacePath, conversationSurfacePath }) {
  const tempDir = resolve(outputDir, "_tmp", itemId);
  await mkdir(tempDir, { recursive: true });
  const outPath = resolve(tempDir, "assembled.md");
  const args = [
    "node_modules/tsx/dist/cli.mjs",
    "scripts/run-repo-face-heartbeats.ts",
    "--assemble-prompt",
    "metame",
    "--out",
    outPath,
  ];
  if (memorySurfacePath) {
    args.push("--memory-surface", memorySurfacePath);
  }
  if (conversationSurfacePath) {
    args.push("--conversation-surface", conversationSurfacePath);
  }
  const run = await runCommand(process.execPath, args, { cwd: voidbotRoot, timeoutMs: 240_000 });
  if (run.code !== 0) {
    throw new Error(`VoidBot prompt assembly failed for ${itemId}:\n${run.stderr || run.stdout}`);
  }
  return {
    result: JSON.parse(run.stdout.trim()),
    prompt: await readFile(outPath, "utf8"),
  };
}

async function runCodex(prompt, { job }) {
  const args = [
    "exec",
    "-m",
    process.env.WEKSA_GOLF_MODEL ?? "gpt-5.4",
    "-c",
    'approval_policy="never"',
    "-c",
    'model_reasoning_effort="low"',
    "--json",
    "--skip-git-repo-check",
    "-s",
    "read-only",
    "-",
  ];
  const command = process.env.WEKSA_CODEX_EXECUTABLE ?? "C:\\Users\\Meta\\AppData\\Roaming\\npm\\codex.cmd";
  const run = await runCommand(command, args, {
    cwd: repoRoot,
    input: prompt,
    timeoutMs: Number(process.env.WEKSA_GOLF_TIMEOUT_MS ?? 240_000),
  });
  await writeFile(resolve(outputDir, `${sanitizeJob(job)}.stdout.jsonl`), run.stdout, "utf8");
  await writeFile(resolve(outputDir, `${sanitizeJob(job)}.stderr.txt`), run.stderr, "utf8");
  if (run.code !== 0) {
    throw new Error(`Codex generation failed for ${job}:\n${run.stderr || run.stdout}`);
  }
  const text = extractLastCodexAgentMessage(run.stdout).trim();
  if (!text) {
    throw new Error(`Codex generation produced no final text for ${job}.`);
  }
  return text;
}

function renderDryRunInterlingua(item) {
  return [
    "interlingua_version: weksa.interlingua.v0",
    `packet_id: metame-casual-pre2025-${item.id}`,
    "kind: persona_discord_turn_intent",
    "provenance:",
    "  produced_by: dry_run_fixture_from_existing_interlingua",
    "context:",
    "  medium: Discord",
    "  fixture_id: metame-casual-pre2025",
    `  item_id: ${item.id}`,
    "discourse:",
    ...indentBlock(item.interlinguaBlock, "  "),
    "constraints:",
    "  lowering:",
    "    target_profile: weksa.target_cultural_ontology.en-US.metacrat_casual_pre2025.v0",
    "    avoid_surface_copy: true",
  ].join("\n");
}

function renderDryRunLowering(item) {
  return [
    "schema_version: weksa.persona_culture_lowering_output.v0",
    "fixture_id: metame-casual-pre2025",
    `item_id: ${item.id}`,
    `spoken_text: ${JSON.stringify(item.groundTruth)}`,
    "trace:",
    "  activated_profiles:",
    "    - weksa.target_cultural_ontology.en-US.metacrat_casual_pre2025.v0",
    "  activated_affordances:",
    "    - dry_run_answer_key_oracle",
    "  notes:",
    "    - Dry run uses answer key only to verify harness plumbing. Use --real for model golf.",
  ].join("\n");
}

function redactHoldouts(text, holdouts) {
  let redacted = text;
  for (const holdout of holdouts) {
    redacted = replaceAllLiteral(redacted, holdout, "[held-out fixture utterance redacted]");
    redacted = replaceAllLiteral(redacted, holdout.replace(/\*/g, ""), "[held-out fixture utterance redacted]");
  }
  return redacted;
}

function replaceAllLiteral(text, needle, replacement) {
  if (!needle) {
    return text;
  }
  return text.split(needle).join(replacement);
}

function extractSpokenText(text) {
  const match = /^spoken_text:\s*(.+)$/m.exec(text);
  if (!match) {
    return text.trim().split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? "";
  }
  const value = match[1].trim();
  if (value.startsWith("\"")) {
    try {
      return JSON.parse(value);
    } catch {
      return value.replace(/^"|"$/g, "");
    }
  }
  return value;
}

function renderEvaluation(item, spokenText, score) {
  return [
    "schema_version: weksa.persona_golf_item_evaluation.v0",
    `fixture_id: metame-casual-pre2025`,
    `item_id: ${item.id}`,
    `message_id: "${item.messageId}"`,
    `generated: ${JSON.stringify(spokenText)}`,
    `ground_truth: ${JSON.stringify(item.groundTruth)}`,
    "score:",
    `  exact_normalized: ${score.exact}`,
    `  token_precision: ${score.precision.toFixed(3)}`,
    `  token_recall: ${score.recall.toFixed(3)}`,
    `  token_f1: ${score.f1.toFixed(3)}`,
  ].join("\n") + "\n";
}

function scoreText(generated, truth) {
  const left = normalizeForScore(generated);
  const right = normalizeForScore(truth);
  const leftTokens = left.split(/\s+/).filter(Boolean);
  const rightTokens = right.split(/\s+/).filter(Boolean);
  const counts = new Map();
  for (const token of rightTokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  let overlap = 0;
  for (const token of leftTokens) {
    const count = counts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(token, count - 1);
    }
  }
  const precision = leftTokens.length ? overlap / leftTokens.length : 0;
  const recall = rightTokens.length ? overlap / rightTokens.length : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { exact: left === right, precision, recall, f1 };
}

function normalizeForScore(value) {
  return value
    .toLowerCase()
    .replace(/[*_`~.,!?;:'"()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Could not extract section ${startMarker}`);
  }
  return text.slice(start + startMarker.length, end);
}

function runCommand(command, args, { cwd, input = "", timeoutMs = 120_000 }) {
  return new Promise((resolveRun) => {
  const isCmdShim = /\.cmd$/i.test(command) || /\.bat$/i.test(command);
  const spawnCommand = isCmdShim ? (process.env.ComSpec ?? "cmd.exe") : command;
  const spawnArgs = isCmdShim ? ["/d", "/s", "/c", command, ...args] : args;
  const child = spawn(spawnCommand, spawnArgs, {
    cwd,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolveRun({ code: -1, stdout, stderr: `${stderr}\n${error.message}` });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolveRun({ code, signal, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

function extractLastCodexAgentMessage(stdout) {
  let last = "";
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    try {
      const event = JSON.parse(line);
      const message = event?.msg?.message ?? event?.message ?? event?.text;
      if (typeof message === "string" && message.trim()) {
        last = message;
      }
      const itemText = event?.item?.text;
      if (typeof itemText === "string" && itemText.trim()) {
        last = itemText;
      }
      const content = event?.item?.content;
      if (Array.isArray(content)) {
        const text = content
          .map((part) => typeof part?.text === "string" ? part.text : "")
          .join("\n")
          .trim();
        if (text) {
          last = text;
        }
      }
    } catch {
      if (line.trim()) {
        last = line.trim();
      }
    }
  }
  return last;
}

function indentBlock(block, prefix) {
  return block.split(/\r?\n/).map((line) => `${prefix}${line}`).join("\n").split(/\r?\n/);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeJob(value) {
  return value.replace(/[^A-Za-z0-9_.-]+/g, "_");
}
