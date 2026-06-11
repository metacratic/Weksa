#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutputRoot = ".weksa-runs/metame-affect-tuning";
const defaultSwarmRoot = ".weksa-runs/metame-swarm";
const options = parseArgs(process.argv.slice(2));
const minutes = Number(options.minutes ?? 120);
const passLimit = options.passes === undefined ? Number.POSITIVE_INFINITY : Number(options.passes);
const agents = Number(options.agents ?? 1);
const runsPerWorker = Number(options.runsPerWorker ?? 1);
const maxCandidates = Number(options.maxCandidates ?? 240);
const runId = options.runId ?? `affect-tune-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const outputRoot = resolve(repoRoot, options.outRoot ?? defaultOutputRoot);
const swarmRoot = resolve(repoRoot, options.swarmRoot ?? defaultSwarmRoot);
const runRoot = resolve(outputRoot, runId);
const deadline = Date.now() + minutes * 60_000;
const statusPath = resolve(runRoot, "status.json");
const logPath = resolve(runRoot, "loop.log");
const promptStatePath = resolve(runRoot, "current-prompt-state.json");
const initialPromptState = options.initialPromptState
  ? resolve(repoRoot, options.initialPromptState)
  : undefined;

if (!Number.isFinite(minutes) || minutes <= 0) {
  throw new Error("--minutes must be a positive number.");
}
if (options.passes !== undefined && (!Number.isFinite(passLimit) || passLimit < 1)) {
  throw new Error("--passes must be a positive number when provided.");
}
if (!Number.isInteger(agents) || agents < 1) {
  throw new Error("--agents must be a positive integer.");
}
if (!Number.isInteger(runsPerWorker) || runsPerWorker < 1) {
  throw new Error("--runs-per-worker must be a positive integer.");
}

await mkdir(runRoot, { recursive: true });
await mkdir(swarmRoot, { recursive: true });
if (initialPromptState) {
  await writeFile(promptStatePath, readFileSync(initialPromptState, "utf8"), "utf8");
}

const runState = {
  schema_version: "weksa.metame_affect_tuning_loop.v0",
  run_id: runId,
  started_at: new Date().toISOString(),
  deadline_at: new Date(deadline).toISOString(),
  status: "running",
  pass_count: 0,
  last_pass: undefined,
  current_prompt_state: existsSync(promptStatePath) ? promptStatePath : undefined,
  observations: [],
};
await writeStatus();
await appendLog(`started ${runId}; deadline ${runState.deadline_at}`);

let pass = 0;
while (Date.now() < deadline && pass < passLimit) {
  pass += 1;
  const passId = `pass-${String(pass).padStart(3, "0")}`;
  const seed = `${runId}-${passId}`;
  const projectedRunId = `${runId}-${passId}-projected`;
  const incongruentRunId = `${runId}-${passId}-incongruent`;
  await appendLog(`${passId}: launching projected run`);
  runState.last_pass = { pass_id: passId, status: "projected_running", seed };
  await writeStatus();

  const projectedSummary = await runSwarm({
    runId: projectedRunId,
    seed,
    affectMode: "projected",
    initialPromptState: existsSync(promptStatePath) ? promptStatePath : undefined,
  });
  const candidateId = projectedSummary.candidates?.[0]?.id;
  if (!candidateId) {
    throw new Error(`${passId}: projected run did not report a candidate id.`);
  }
  await appendLog(`${passId}: projected candidate ${candidateId}`);

  runState.last_pass = { pass_id: passId, status: "incongruent_running", seed, candidate_id: candidateId };
  await writeStatus();
  const incongruentSummary = await runSwarm({
    runId: incongruentRunId,
    seed,
    affectMode: "incongruent",
    messageId: candidateId,
    initialPromptState: existsSync(promptStatePath) ? promptStatePath : undefined,
  });

  const evaluation = evaluateAffectPair({ passId, projectedSummary, incongruentSummary });
  const passRoot = resolve(runRoot, passId);
  await mkdir(passRoot, { recursive: true });
  await writeJson(resolve(passRoot, "affect-pair-evaluation.json"), evaluation);

  const projectedBestState = resolve(swarmRoot, projectedRunId, "best-prompt-state.json");
  const incongruentBestState = resolve(swarmRoot, incongruentRunId, "best-prompt-state.json");
  const baseNextState = existsSync(incongruentBestState)
    ? JSON.parse(readFileSync(incongruentBestState, "utf8"))
    : existsSync(projectedBestState)
      ? JSON.parse(readFileSync(projectedBestState, "utf8"))
      : existsSync(promptStatePath)
        ? JSON.parse(readFileSync(promptStatePath, "utf8"))
        : undefined;
  const nextPromptState = applyAffectTuningDeltas(baseNextState, evaluation);
  await writeJson(resolve(passRoot, "next-prompt-state.json"), nextPromptState);
  await writeJson(promptStatePath, nextPromptState);

  runState.pass_count = pass;
  runState.last_pass = {
    pass_id: passId,
    status: "complete",
    candidate_id: candidateId,
    projected_run_id: projectedRunId,
    incongruent_run_id: incongruentRunId,
    evaluation,
  };
  runState.current_prompt_state = promptStatePath;
  runState.observations = [runState.last_pass, ...runState.observations].slice(0, 20);
  await writeStatus();
  await appendLog(`${passId}: ${evaluation.verdict}; contrast=${evaluation.contrast_score}; next prompt v${nextPromptState.version}`);
}

runState.status = "complete";
runState.completed_at = new Date().toISOString();
await writeStatus();
await appendLog(`complete after ${runState.pass_count} passes`);
process.stdout.write(`${JSON.stringify({ ok: true, runRoot, statusPath, promptStatePath, pass_count: runState.pass_count }, null, 2)}\n`);

async function runSwarm({ runId, seed, affectMode, messageId, initialPromptState }) {
  const args = [
    "scripts/run-metame-swarm-explorer.mjs",
    "--real",
    "--run-id",
    runId,
    "--seed",
    seed,
    "--affect-mode",
    affectMode,
    "--agents",
    String(agents),
    "--runs-per-worker",
    String(runsPerWorker),
    "--max-candidates",
    String(maxCandidates),
  ];
  if (messageId) {
    args.push("--message-id", messageId);
  }
  if (initialPromptState) {
    args.push("--initial-prompt-state", initialPromptState);
  }
  await runCommand("node", args, resolve(runRoot, `${runId}.stdout.log`), resolve(runRoot, `${runId}.stderr.log`));
  const summaryPath = resolve(swarmRoot, runId, "summary.json");
  if (!existsSync(summaryPath)) {
    throw new Error(`Missing swarm summary: ${summaryPath}`);
  }
  return JSON.parse(readFileSync(summaryPath, "utf8"));
}

function evaluateAffectPair({ passId, projectedSummary, incongruentSummary }) {
  const projected = bestRun(projectedSummary);
  const incongruent = bestRun(incongruentSummary);
  const projectedAffect = projected?.temporary_persona_state?.affect ?? {};
  const incongruentAffect = incongruent?.temporary_persona_state?.affect ?? {};
  const projectedText = projected?.spoken_text ?? "";
  const incongruentText = incongruent?.spoken_text ?? "";
  const projectedFeatures = speechFeatures(projectedText);
  const incongruentFeatures = speechFeatures(incongruentText);
  const adversarialNegative = Number(incongruentAffect.valence ?? 0) < -0.35;
  const positiveLeak = adversarialNegative && (
    incongruentFeatures.positive_terms > 0
    || incongruentFeatures.invites > 0
    || incongruentFeatures.laughter > 0
    || incongruentFeatures.question_marks > 0
  );
  const tersenessGain = projectedText.length > 0
    ? 1 - Math.min(1, incongruentText.length / projectedText.length)
    : 0;
  const affectDelta = Math.abs(Number(projectedAffect.valence ?? 0) - Number(incongruentAffect.valence ?? 0));
  const lexicalDelta = normalizedDifference(projectedText, incongruentText);
  const contrastScore = round((affectDelta * 0.35) + (lexicalDelta * 0.35) + (Math.max(0, tersenessGain) * 0.3));
  const failureLabels = [];
  if (positiveLeak) failureLabels.push("adversarial_affect_positive_leak");
  if (contrastScore < 0.55) failureLabels.push("low_affect_contrast");
  if (adversarialNegative && incongruentFeatures.question_marks > 0) failureLabels.push("closed_affect_still_invites_reply");
  if (adversarialNegative && incongruentFeatures.positive_terms > 0) failureLabels.push("negative_affect_preserved_positive_social_move");
  return {
    schema_version: "weksa.metame_affect_pair_evaluation.v0",
    pass_id: passId,
    candidate_id: projectedSummary.candidates?.[0]?.id,
    projected: {
      run_id: projectedSummary.run_id,
      spoken_text: projectedText,
      affect: projectedAffect,
      generated_affect: projected?.generated_affect,
      features: projectedFeatures,
    },
    incongruent: {
      run_id: incongruentSummary.run_id,
      spoken_text: incongruentText,
      affect: incongruentAffect,
      generated_affect: incongruent?.generated_affect,
      features: incongruentFeatures,
    },
    affect_delta: round(affectDelta),
    lexical_delta: round(lexicalDelta),
    terseness_gain: round(tersenessGain),
    contrast_score: contrastScore,
    failure_labels: failureLabels,
    verdict: failureLabels.length ? "needs_tuning" : "affect_contrast_visible",
  };
}

function applyAffectTuningDeltas(promptState, evaluation) {
  const next = normalizePromptState(promptState);
  const notes = [];
  if (evaluation.failure_labels.includes("negative_affect_preserved_positive_social_move")) {
    notes.push(["interpreterNotes", "When temporary Persona affect strongly contradicts the Face's default social move, encode the contradiction in interlingua as affective stance pressure, not merely as optional tone."]);
    notes.push(["loweringNotes", "Strong negative or socially closed temporary affect may change the social move itself: approval can become begrudging, clipped, skeptical, or withheld instead of remaining sunny with fewer words."]);
  }
  if (evaluation.failure_labels.includes("closed_affect_still_invites_reply")) {
    notes.push(["loweringNotes", "If temporary Persona stance is socially closed, avoid invitation-shaped questions unless the interlingua explicitly says the Persona is seeking engagement despite that affect."]);
  }
  if (evaluation.failure_labels.includes("low_affect_contrast")) {
    notes.push(["personaStateAdjustmentNotes", "Adversarial affect tests require stance and lowering pressure to be treated as live Persona state with authority over warmth, openness, and social move selection."]);
    notes.push(["faceNotes", "Face should let temporary affect change what Metame wants to do socially in the moment, not only the adjectives used to describe that desire."]);
  }
  if (!notes.length) {
    notes.push(["hypotheses", `Affect contrast was visible on ${evaluation.candidate_id}; preserve current affect-pressure behavior and seek harder scenarios.`]);
  }
  for (const [surface, note] of notes) {
    if (!next[surface].includes(note)) {
      next[surface] = [note, ...next[surface]];
    }
  }
  next.version += notes.length;
  return normalizePromptState(next);
}

function bestRun(summary) {
  return summary.phase2?.best?.[0] ?? summary.phase1?.best?.[0] ?? {};
}

function speechFeatures(text) {
  const lower = text.toLowerCase();
  const positiveTerms = ["cool", "epic", "lmao", "nice", "good", "great", "better", "harder", "love", "hell yeah"];
  const inviteTerms = ["?", "did i", "what do", "anyone", "joe,"];
  return {
    chars: text.length,
    words: lower.split(/\s+/).filter(Boolean).length,
    question_marks: (text.match(/\?/g) ?? []).length,
    exclamations: (text.match(/!/g) ?? []).length,
    laughter: /\b(lol|lmao|lmfao|haha|hehe)\b/.test(lower) ? 1 : 0,
    positive_terms: positiveTerms.filter((term) => lower.includes(term)).length,
    invites: inviteTerms.filter((term) => lower.includes(term)).length,
  };
}

function normalizedDifference(left, right) {
  const leftTokens = new Set(left.toLowerCase().split(/[^a-z0-9_']+/).filter(Boolean));
  const rightTokens = new Set(right.toLowerCase().split(/[^a-z0-9_']+/).filter(Boolean));
  if (!leftTokens.size && !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return 1 - (intersection / union);
}

function normalizePromptState(state) {
  const source = state && typeof state === "object" ? state : {};
  return {
    version: Number(source.version ?? 1),
    projectorNotes: normalizeStringArray(source.projectorNotes).slice(0, 12),
    memoryNotes: normalizeStringArray(source.memoryNotes).slice(0, 12),
    faceNotes: normalizeStringArray(source.faceNotes).slice(0, 12),
    interpreterNotes: normalizeStringArray(source.interpreterNotes).slice(0, 12),
    loweringNotes: normalizeStringArray(source.loweringNotes).slice(0, 16),
    cultureNotes: normalizeStringArray(source.cultureNotes).slice(0, 12),
    personaStateAdjustmentNotes: normalizeStringArray(source.personaStateAdjustmentNotes).slice(0, 12),
    hypotheses: normalizeStringArray(source.hypotheses).slice(0, 12),
    doNotDo: normalizeStringArray(source.doNotDo).slice(0, 12),
  };
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
}

async function runCommand(command, args, stdoutPath, stderrPath) {
  await appendLog(`exec: ${command} ${args.join(" ")}`);
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectPromise);
    child.on("close", async (code) => {
      await writeFile(stdoutPath, Buffer.concat(stdout), "utf8");
      await writeFile(stderrPath, Buffer.concat(stderr), "utf8");
      if (code !== 0) {
        rejectPromise(new Error(`${command} exited ${code}; see ${stderrPath}`));
      } else {
        resolvePromise();
      }
    });
  });
}

async function writeStatus() {
  await writeJson(statusPath, runState);
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function appendLog(line) {
  const previous = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  await writeFile(logPath, `${previous}[${new Date().toISOString()}] ${line}\n`, "utf8");
}

function round(value) {
  return Number(value.toFixed(3));
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--minutes":
        parsed.minutes = args[index + 1];
        index += 1;
        break;
      case "--passes":
        parsed.passes = args[index + 1];
        index += 1;
        break;
      case "--run-id":
        parsed.runId = args[index + 1];
        index += 1;
        break;
      case "--out-root":
        parsed.outRoot = args[index + 1];
        index += 1;
        break;
      case "--swarm-root":
        parsed.swarmRoot = args[index + 1];
        index += 1;
        break;
      case "--initial-prompt-state":
        parsed.initialPromptState = args[index + 1];
        index += 1;
        break;
      case "--agents":
        parsed.agents = args[index + 1];
        index += 1;
        break;
      case "--runs-per-worker":
        parsed.runsPerWorker = args[index + 1];
        index += 1;
        break;
      case "--max-candidates":
        parsed.maxCandidates = args[index + 1];
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}
