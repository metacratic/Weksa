#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const voidbotRoot = resolve("E:/Projects/VoidBot");
const fixtureRoot = resolve(repoRoot, "examples/persona-lowering/metame-casual-pre2025");
const defaultArchivePath = "E:/Projects/VoidBot/.voidbot/rag/messages.json";
const defaultAuthorId = "113785782975594501";
const defaultOutputRoot = ".weksa-runs/metame-swarm";
const cultureProfilePaths = [
  "data/cultural-ontology/cultures/dutch-american-diaspora.yaml",
  "data/cultural-ontology/cultures/western-europe-maritime-childhood.yaml",
  "data/cultural-ontology/cultures/portugal-resident-algarve-lisbon.yaml",
  "data/cultural-ontology/cultures/texas-houston-us-adolescence.yaml",
  "data/cultural-ontology/subcultures/online-game-dev-discord-pre2025.yaml",
  "data/cultural-ontology/subcultures/gamecult-open-source-crypto-anarchist.yaml",
];
const promptStateKeys = [
  "projectorNotes",
  "memoryNotes",
  "faceNotes",
  "interpreterNotes",
  "loweringNotes",
  "cultureNotes",
  "personaStateAdjustmentNotes",
  "hypotheses",
  "doNotDo",
];

const options = parseArgs(process.argv.slice(2));
const dryRun = !options.real;
const agents = Number(options.agents ?? options.workers ?? 4);
const runsPerAgent = Number(options.runsPerWorker ?? 1);
const seed = options.seed ?? new Date().toISOString().slice(0, 10);
const runId = options.runId ?? `swarm-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const outputRoot = resolve(repoRoot, options.outRoot ?? defaultOutputRoot);
const runRoot = resolve(outputRoot, runId);
const initialPromptStatePath = options.initialPromptState
  ? resolve(repoRoot, options.initialPromptState)
  : undefined;
const beforeMs = Date.parse(options.before ?? "2025-01-01T00:00:00Z");
const authorId = options.authorId ?? defaultAuthorId;
const archivePath = resolve(options.archive ?? defaultArchivePath);
const maxCandidates = Number(options.maxCandidates ?? 240);
const adjacencyMinutes = Number(options.adjacencyMinutes ?? 60);
const candidateMessageId = options.messageId;

if (!Number.isInteger(agents) || agents < 1) {
  throw new Error("--agents/--workers must be a positive integer.");
}
if (!Number.isInteger(runsPerAgent) || runsPerAgent < 1) {
  throw new Error("--runs-per-worker must be a positive integer.");
}

await mkdir(runRoot, { recursive: true });

const archive = loadArchive(archivePath);
const ledger = await loadPriorLedger(outputRoot);
const candidates = buildCandidates(archive.messages, {
  authorId,
  beforeMs,
  adjacencyMs: adjacencyMinutes * 60_000,
});
const selectedCandidates = candidateMessageId
  ? [mustFindCandidate(candidates, candidateMessageId)]
  : chooseCandidateSet(candidates, ledger, { seed, maxCandidates, count: agents });

const holdouts = selectedCandidates.map((candidate) => candidate.target.content);
const culturePack = await loadCulturePack(holdouts);
const baseMemorySurface = dryRun
  ? renderDryBaseMemorySurface()
  : await renderProjectedBaseMemorySurface(runRoot);
const defaultPromptState = {
  version: 1,
  projectorNotes: [
    "Surface current scenario pressure as lived context, not as schema mechanics.",
  ],
  memoryNotes: [
    "Treat the selected Discord moment as current and unresolved.",
    "The target utterance is hidden from generation and appears only in scoring.",
  ],
  faceNotes: [
    "Metame should think normally in her own voice before any interlingua exists.",
    "A normal Face output may include Private thought and Would say; do not ask the Face to write Weksa packets.",
  ],
  interpreterNotes: [
    "The Interpreter converts natural Face output into Weksa interlingua intent.",
    "Preserve speech act, social move, stance, referents, and constraints; do not copy the final surface as a target.",
  ],
  loweringNotes: [
    "Preserve Persona-produced social intent over generic assistant helpfulness.",
    "Use prior context as evidence for selection, not as material to quote back unless explanation is the speech act.",
    "When interlingua preserves a salient keyword or identity label, do not replace it with a new joke unless the culture stack asks for that.",
  ],
  cultureNotes: [
    "Missing behavior should become candidate culture/subculture ontology only when it generalizes beyond one answer.",
  ],
  personaStateAdjustmentNotes: [
    "Temporary run memory may be adjusted to make the scenario current; canonical Persona state is not mutated by the swarm.",
  ],
};
const promptState = initialPromptStatePath
  ? normalizePromptState({
      ...defaultPromptState,
      ...JSON.parse(readFileSync(initialPromptStatePath, "utf8")),
    })
  : defaultPromptState;

await writeJson(resolve(runRoot, "candidates.json"), selectedCandidates.map(redactedCandidateRecord));
await Promise.all(selectedCandidates.map(async (candidate, index) => {
  const candidateRoot = resolve(runRoot, "candidates", `${index}-${candidate.id}`);
  await mkdir(candidateRoot, { recursive: true });
  await writeFile(resolve(candidateRoot, "conversation-before.md"), renderConversationBefore(candidate), "utf8");
  await writeFile(resolve(candidateRoot, "target.answer.txt"), `${candidate.target.content.trim()}\n`, "utf8");
}));
await writeJson(resolve(runRoot, "initial-prompt-state.json"), promptState);

const phase1 = await runPhase({
  phase: "phase1",
  candidates: selectedCandidates,
  promptState,
  baseMemorySurface,
  culturePack,
  agents,
  runsPerAgent,
  dryRun,
});

const optimization = dryRun
  ? renderDryOptimization(promptState, phase1)
  : await runOptimizationPass({ candidates: selectedCandidates, promptState, phaseSummary: phase1, culturePack });
const optimizedPromptState = optimization.promptState;
await writeJson(resolve(runRoot, "optimizer-contract.json"), optimization.contract);
await writeJson(resolve(runRoot, "applied-prompt-deltas.json"), optimization.appliedDeltas);
await writeJson(resolve(runRoot, "optimized-prompt-state.json"), optimizedPromptState);

const phase2 = await runPhase({
  phase: "phase2",
  candidates: selectedCandidates,
  promptState: optimizedPromptState,
  baseMemorySurface,
  culturePack,
  agents,
  runsPerAgent,
  dryRun,
});

const summary = {
  schema_version: "weksa.metame_swarm_explorer_run.v0",
  run_id: runId,
  mode: dryRun ? "dry_run" : "real",
  seed,
  agents,
  runs_per_agent: runsPerAgent,
  candidates: selectedCandidates.map(redactedCandidateRecord),
  phase1: summarizePhase(phase1),
  phase2: summarizePhase(phase2),
  high_loss_signal: pickHighLoss([...phase1.runs, ...phase2.runs]),
};
const bestPromptState = summary.phase2.avg_loss <= summary.phase1.avg_loss
  ? optimizedPromptState
  : promptState;
await writeJson(resolve(runRoot, "best-prompt-state.json"), bestPromptState);
await writeJson(resolve(runRoot, "summary.json"), summary);
await appendLedger(outputRoot, summary);

process.stdout.write(`${JSON.stringify({ ok: true, runRoot, summary }, null, 2)}\n`);

async function runPhase(input) {
  const phaseRoot = resolve(runRoot, input.phase);
  await mkdir(phaseRoot, { recursive: true });
  const jobs = [];
  for (let agent = 0; agent < input.agents; agent += 1) {
    const candidate = input.candidates[agent % input.candidates.length];
    for (let index = 0; index < input.runsPerAgent; index += 1) {
      jobs.push({
        agent,
        worker: agent,
        attempt: index,
        candidate,
        id: `${input.phase}-a${agent}-r${index}-${candidate.id}`,
      });
    }
  }

  const runs = await runPool(jobs, input.agents, async (job) => {
    const attemptRoot = resolve(phaseRoot, job.id);
    await mkdir(attemptRoot, { recursive: true });
    return runAttempt({
      ...input,
      job,
      attemptRoot,
    });
  });

  const phase = {
    phase: input.phase,
    prompt_state: input.promptState,
    runs,
  };
  await writeJson(resolve(phaseRoot, "summary.json"), phase);
  return phase;
}

async function runAttempt(input) {
  const candidate = input.job.candidate;
  const temporaryPersonaStateRequest = renderTemporaryPersonaStateRequest({ candidate, promptState: input.promptState });
  await writeFile(resolve(input.attemptRoot, "temporary-persona-state-request.md"), temporaryPersonaStateRequest, "utf8");
  const temporaryPersonaState = input.dryRun
    ? renderDryTemporaryPersonaState(candidate)
    : await runCodex(temporaryPersonaStateRequest, {
        job: `${input.job.id}:persona-state-projector`,
        cwd: repoRoot,
        logRoot: input.attemptRoot,
      });
  const temporaryPersonaStatePath = resolve(input.attemptRoot, "temporary-persona-state.cc");
  await writeFile(temporaryPersonaStatePath, `${temporaryPersonaState.trim()}\n`, "utf8");

  const memorySurface = renderMemorySurface({
    baseMemorySurface: input.baseMemorySurface,
    candidate,
    promptState: input.promptState,
    job: input.job,
    temporaryPersonaState,
    temporaryPersonaStatePath,
  });
  const conversationSurface = renderConversationSurface(candidate);
  await writeFile(resolve(input.attemptRoot, "memory-surface.md"), memorySurface, "utf8");
  await writeFile(resolve(input.attemptRoot, "conversation-surface.md"), conversationSurface, "utf8");

  const assembledPrompt = input.dryRun
    ? renderDryAssembledPrompt(memorySurface, conversationSurface)
    : await assembleVoidBotPrompt({
        outDir: input.attemptRoot,
        memorySurfacePath: resolve(input.attemptRoot, "memory-surface.md"),
        conversationSurfacePath: resolve(input.attemptRoot, "conversation-surface.md"),
      });
  await writeFile(resolve(input.attemptRoot, "voidbot-assembled-prompt.md"), assembledPrompt, "utf8");

  const faceTurnRequest = renderFaceTurnRequest({
    assembledPrompt,
    candidate,
    promptState: input.promptState,
  });
  await writeFile(resolve(input.attemptRoot, "face-turn-request.md"), faceTurnRequest, "utf8");
  const faceTurn = input.dryRun
    ? renderDryFaceTurn(candidate)
    : await runCodex(faceTurnRequest, {
        job: `${input.job.id}:face-turn`,
        cwd: repoRoot,
        logRoot: input.attemptRoot,
      });
  await writeFile(resolve(input.attemptRoot, "face-turn-output.md"), `${faceTurn.trim()}\n`, "utf8");

  const interlinguaRequest = renderInterpreterInterlinguaRequest({
    faceTurn,
    candidate,
    promptState: input.promptState,
  });
  await writeFile(resolve(input.attemptRoot, "interpreter-interlingua-request.md"), interlinguaRequest, "utf8");
  const interlingua = input.dryRun
    ? renderDryInterlingua(candidate)
    : await runCodex(interlinguaRequest, {
        job: `${input.job.id}:interpreter-interlingua`,
        cwd: repoRoot,
        logRoot: input.attemptRoot,
      });
  await writeFile(resolve(input.attemptRoot, "interpreter-interlingua.yaml"), `${interlingua.trim()}\n`, "utf8");

  const loweringRequest = renderWeksaLoweringRequest({
    memorySurface,
    temporaryPersonaState,
    temporaryPersonaStatePath,
    culturePack: input.culturePack,
    interlingua,
    promptState: input.promptState,
    holdouts: input.candidates.map((entry) => entry.target.content),
  });
  await writeFile(resolve(input.attemptRoot, "weksa-lowering-request.md"), loweringRequest, "utf8");
  const lowered = input.dryRun
    ? renderDryLowering(candidate, input.job)
    : await runCodex(loweringRequest, {
        job: `${input.job.id}:weksa-lowering`,
        cwd: repoRoot,
        logRoot: input.attemptRoot,
      });
  await writeFile(resolve(input.attemptRoot, "weksa-lowered-output.yaml"), `${lowered.trim()}\n`, "utf8");

  const spokenText = extractSpokenText(lowered);
  const score = scoreText(spokenText, candidate.target.content);
  const run = {
    id: input.job.id,
    agent: input.job.agent,
    worker: input.job.worker,
    attempt: input.job.attempt,
    candidate: redactedCandidateRecord(candidate),
    temporary_persona_state: summarizeTemporaryPersonaState(temporaryPersonaState),
    spoken_text: spokenText,
    generated_affect: inferTextAffect(spokenText),
    target_text: candidate.target.content,
    score,
    loss: Number((1 - score.f1).toFixed(3)),
  };
  await writeJson(resolve(input.attemptRoot, "evaluation.json"), run);
  return run;
}

async function runOptimizationPass({ candidates, promptState, phaseSummary, culturePack }) {
  const optimizerRoot = resolve(runRoot, "optimizer");
  await mkdir(optimizerRoot, { recursive: true });
  const highLoss = pickHighLoss(phaseSummary.runs);
  const request = [
    "You are optimizing Weksa Persona-culture lowering prompts and temporary memory surfaces.",
    "",
    "Do not change canonical Persona state. Do not reveal or memorize the held-out target as an example to copy.",
    "Use high-loss runs as signal about missing prompt/memory/culture salience.",
    "Your authority is diagnostic and incremental. Do not replace the whole prompt state.",
    "Emit candidate-scoped failure diagnoses and weighted prompt deltas.",
    "A global prompt delta should have repeated evidence across candidates unless confidence is extremely high.",
    "Prefer no delta over laundering one weird held-out moment into policy.",
    "Return JSON only with this shape:",
    "{",
    "  \"version\": 1,",
    "  \"candidateDiagnoses\": [",
    "    {",
    "      \"candidate_id\": \"...\",",
    "      \"run_id\": \"...\",",
    "      \"loss\": 0.0,",
    "      \"failure_labels\": [\"stance_error\", \"referent_loss\", \"affect_mismatch\"],",
    "      \"evidence\": \"short source-grounded reason, no target wording\",",
    "      \"confidence\": 0.0",
    "    }",
    "  ],",
    "  \"promptDeltas\": [",
    "    {",
    "      \"surface\": \"interpreterNotes\",",
    "      \"operation\": \"add\",",
    "      \"note\": \"one durable steering note\",",
    "      \"weight\": 0.0,",
    "      \"evidence_candidate_ids\": [\"...\"],",
    "      \"failure_labels\": [\"...\"]",
    "    }",
    "  ],",
    "  \"globalHypotheses\": [\"...\"],",
    "  \"doNotDo\": [\"...\"]",
    "}",
    "",
    "Allowed prompt delta surfaces:",
    JSON.stringify(promptStateKeys, null, 2),
    "",
    "Failure labels should include affect mismatches when the generated line's affect does not match the temporary Persona `.cc` projection.",
    "",
    "Delta acceptance policy in the harness:",
    "- apply add-deltas only",
    "- accept weight >= 0.85 with at least one candidate",
    "- accept weight >= 0.65 only when backed by at least two candidate ids",
    "- dedupe notes and keep prompt-state arrays bounded",
    "",
    "Candidate metadata:",
    JSON.stringify(candidates.map(redactedCandidateRecord), null, 2),
    "",
    "Target answer is withheld from generation. For optimizer scoring only, normalized loss summary:",
    JSON.stringify(highLoss, null, 2),
    "",
    "Current prompt state:",
    JSON.stringify(promptState, null, 2),
    "",
    "Culture profile ids available:",
    JSON.stringify(culturePack.profileIds, null, 2),
  ].join("\n");
  await writeFile(resolve(optimizerRoot, "optimizer-request.md"), request, "utf8");
  const output = await runCodex(request, {
    job: "optimizer",
    cwd: repoRoot,
    logRoot: optimizerRoot,
  });
  await writeFile(resolve(optimizerRoot, "optimizer-output.txt"), `${output.trim()}\n`, "utf8");
  const parsed = extractJsonObject(output);
  const contract = normalizeOptimizerContract(parsed, phaseSummary);
  await writeJson(resolve(optimizerRoot, "optimizer-contract.json"), contract);
  const applied = applyPromptDeltas(promptState, contract);
  await writeJson(resolve(optimizerRoot, "applied-prompt-deltas.json"), applied.appliedDeltas);
  return {
    promptState: applied.promptState,
    contract,
    appliedDeltas: applied.appliedDeltas,
  };
}

function renderFaceTurnRequest({ assembledPrompt, candidate, promptState }) {
  return [
    "# Metame Face Worker",
    "",
    "Be Metame for one private VoidBot Persona turn. Think normally as the Face.",
    "Do not produce Weksa interlingua. Do not see or infer the held-out target utterance.",
    "",
    "Temporary optimization notes:",
    ...promptState.faceNotes.map((note) => `- ${note}`),
    "",
    "Temporary memory/projector notes:",
    ...promptState.projectorNotes.map((note) => `- ${note}`),
    ...promptState.memoryNotes.map((note) => `- ${note}`),
    "",
    "VoidBot assembled prompt:",
    "```markdown",
    assembledPrompt,
    "```",
    "",
    "Current candidate moment, target withheld:",
    "```yaml",
    renderCandidateScene(candidate),
    "```",
    "",
    "Return natural Face output using the familiar shape when useful: Private thought, Would say, What should stick.",
  ].join("\n");
}

function renderTemporaryPersonaStateRequest({ candidate, promptState }) {
  return [
    "# Historical Persona-State Projector",
    "",
    "Project a temporary Persona state overlay for this held-out historical scenario.",
    "Use only visible context and candidate metadata. The target utterance is hidden and must not be inferred as text.",
    "This is not canonical Persona state. It is a run-scoped `.cc` projection for affect, stance, social pressure, and live-room posture.",
    "",
    "Return YAML-compatible CultCache text only with this shape:",
    "schema_version: weksa.temporary_persona_state_projection.v0",
    "authority: run_scoped_projection_not_canonical",
    "persona:",
    "  id: metame",
    "  canonical_state_ref: E:/Projects/VoidBot/.voidbot/private/personas/metame/metame.cc",
    "scenario:",
    "  candidate_id:",
    "  channel:",
    "  year:",
    "affect:",
    "  valence: -1.0_to_1.0",
    "  arousal: 0.0_to_1.0",
    "  dominance: 0.0_to_1.0",
    "  labels: []",
    "  evidence: []",
    "stance:",
    "  posture:",
    "  social_move_likelihoods: []",
    "  register_pressure: []",
    "lowering_pressure:",
    "  should_sound:",
    "  should_not_sound:",
    "",
    "Temporary optimizer notes:",
    ...promptState.memoryNotes.map((note) => `- ${note}`),
    ...promptState.interpreterNotes.map((note) => `- ${note}`),
    ...promptState.loweringNotes.map((note) => `- ${note}`),
    "",
    "Visible scenario:",
    "```yaml",
    renderCandidateScene(candidate),
    "```",
  ].join("\n");
}

function renderInterpreterInterlinguaRequest({ faceTurn, candidate, promptState }) {
  return [
    "# Face Interpreter To Weksa Interlingua",
    "",
    "You are the Interpreter between natural Metame Face output and Weksa.",
    "VoidBot's current Interpreter is mostly passthrough; this harness tests the missing authority boundary.",
    "Convert the Face's normal thought/speech intent into Weksa interlingua. Do not lower to final English.",
    "",
    "Temporary interpreter notes:",
    ...promptState.interpreterNotes.map((note) => `- ${note}`),
    "",
    "Current candidate moment, target withheld:",
    "```yaml",
    renderCandidateScene(candidate),
    "```",
    "",
    "Natural Face output:",
    "```markdown",
    faceTurn,
    "```",
    "",
    "Return one YAML interlingua packet.",
  ].join("\n");
}

function renderWeksaLoweringRequest({ memorySurface, temporaryPersonaState, temporaryPersonaStatePath, culturePack, interlingua, promptState, holdouts }) {
  const redactedProfiles = culturePack.profiles.map((profile) => ({
    ...profile,
    text: redactHoldouts(profile.text, holdouts),
  }));
  return [
    "# Weksa Lowering Worker",
    "",
    "Lower Persona-produced interlingua into one Discord utterance.",
    "Do not copy from target history; the target utterance is not present in this prompt.",
    "",
    "Temporary optimization notes:",
    ...promptState.loweringNotes.map((note) => `- ${note}`),
    "",
    "Temporary culture ontology notes:",
    ...promptState.cultureNotes.map((note) => `- ${note}`),
    "",
    "Projected Metame memory/context surface:",
    "```markdown",
    memorySurface,
    "```",
    "",
    "Temporary Persona `.cc` projection mounted for this test:",
    temporaryPersonaStatePath,
    "```yaml",
    redactHoldouts(temporaryPersonaState, holdouts),
    "```",
    "",
    "Metame cultural stack reference:",
    "```yaml",
    culturePack.stack,
    "```",
    "",
    "Referenced Weksa culture/subculture profiles:",
    ...redactedProfiles.flatMap((profile) => [
      "",
      `# ${profile.path}`,
      "```yaml",
      profile.text,
      "```",
    ]),
    "",
    "Target-language surface overlay:",
    "```yaml",
    redactHoldouts(culturePack.targetOverlay, holdouts),
    "```",
    "",
    "Persona-produced interlingua:",
    "```yaml",
    interlingua,
    "```",
    "",
    "Return YAML with `spoken_text` and a trace.",
  ].join("\n");
}

function buildCandidates(messages, { authorId, beforeMs, adjacencyMs }) {
  const usable = messages
    .filter((message) => !message.deletedAt)
    .filter((message) => typeof message.content === "string" && message.content.trim().length > 0)
    .filter((message) => message.metadata?.messageKind !== "bot_prompt")
    .sort(compareByTimestamp);
  const byChannel = new Map();
  for (const message of usable) {
    if (!byChannel.has(message.channelId)) {
      byChannel.set(message.channelId, []);
    }
    byChannel.get(message.channelId).push(message);
  }

  const candidates = [];
  for (const [channelId, channelMessages] of byChannel) {
    for (let index = 0; index < channelMessages.length; index += 1) {
      const target = channelMessages[index];
      if (target.authorId !== authorId || timestampMs(target) >= beforeMs) {
        continue;
      }
      const content = target.content.trim();
      if (!isCandidateTarget(content)) {
        continue;
      }
      const currentMs = timestampMs(target);
      const before = channelMessages
        .slice(Math.max(0, index - 10), index)
        .filter((message) => currentMs - timestampMs(message) <= adjacencyMs);
      if (before.length < 1) {
        continue;
      }
      const after = channelMessages
        .slice(index + 1, index + 5)
        .filter((message) => timestampMs(message) - currentMs <= adjacencyMs);
      candidates.push({
        id: target.id,
        target,
        before,
        after,
        channelId,
        channelName: target.metadata?.channelName ?? "",
        year: yearOf(target.timestamp),
        lengthClass: classifyLength(content.length),
        features: detectFeatures(content, before, authorId),
      });
    }
  }
  return candidates;
}

function chooseCandidate(candidates, ledger, { seed, maxCandidates }) {
  const rng = createRandom(seed);
  const scored = candidates.map((candidate) => {
    const stratum = candidateStratum(candidate);
    const prior = ledger.strata[stratum] ?? { count: 0, avgLoss: 0.5 };
    const featureNovelty = candidate.features.reduce((sum, feature) => {
      const seen = ledger.features[feature] ?? 0;
      return sum + 1 / Math.sqrt(seen + 1);
    }, 0);
    const underexplored = 1 / Math.sqrt(prior.count + 1);
    const highLossPull = prior.avgLoss;
    const jitter = rng() * 0.18;
    const score = underexplored * 1.4 + featureNovelty * 0.45 + highLossPull * 0.9 + jitter;
    return { candidate, score, stratum };
  }).sort((left, right) => right.score - left.score);
  const pool = scored.slice(0, Math.max(1, Math.min(maxCandidates, scored.length)));
  const total = pool.reduce((sum, entry) => sum + entry.score, 0);
  let pick = rng() * total;
  for (const entry of pool) {
    pick -= entry.score;
    if (pick <= 0) {
      return entry.candidate;
    }
  }
  return pool[0].candidate;
}

function chooseCandidateSet(candidates, ledger, { seed, maxCandidates, count }) {
  const selected = [];
  const selectedIds = new Set();
  for (let index = 0; index < count; index += 1) {
    const remaining = candidates.filter((candidate) => !selectedIds.has(candidate.id));
    if (remaining.length === 0) {
      break;
    }
    const candidate = chooseCandidate(remaining, ledger, {
      seed: `${seed}:agent:${index}`,
      maxCandidates,
    });
    selected.push(candidate);
    selectedIds.add(candidate.id);
    const stratum = candidateStratum(candidate);
    const prior = ledger.strata[stratum] ?? { count: 0, totalLoss: 0, avgLoss: 0.5 };
    ledger.strata[stratum] = {
      ...prior,
      count: prior.count + 1,
      totalLoss: prior.totalLoss ?? prior.avgLoss * prior.count,
      avgLoss: prior.avgLoss,
    };
    for (const feature of candidate.features) {
      ledger.features[feature] = (ledger.features[feature] ?? 0) + 1;
    }
  }
  return selected;
}

function mustFindCandidate(candidates, messageId) {
  const candidate = candidates.find((entry) => entry.id === messageId);
  if (!candidate) {
    throw new Error(`No eligible candidate found for message ${messageId}.`);
  }
  return candidate;
}

function renderConversationSurface(candidate) {
  return [
    "Read this as the current timeline moment. The target Metacrat utterance is withheld.",
    "Messages are ordered oldest to newest.",
    "",
    `Channel: ${candidate.channelName || candidate.channelId}`,
    `Target message id: ${candidate.target.id} (hidden)`,
    "",
    "Visible context before the hidden target:",
    ...candidate.before.map(formatContextLine),
  ].join("\n");
}

function renderMemorySurface({ baseMemorySurface, candidate, promptState, job, temporaryPersonaState, temporaryPersonaStatePath }) {
  return [
    baseMemorySurface,
    "",
    "Temporary swarm exploration adjustment:",
    `- Worker ${job.worker}, run ${job.attempt}.`,
    `- Treat channel ${candidate.channelName || candidate.channelId} in ${candidate.year} as the live room.`,
    `- The hidden target is a ${candidate.lengthClass} Metacrat message after the visible context.`,
    `- Candidate features: ${candidate.features.join(", ") || "none"}.`,
    `- Temporary Persona .cc projection path: ${temporaryPersonaStatePath}`,
    "- Temporary Persona .cc projection body:",
    "```yaml",
    temporaryPersonaState.trim(),
    "```",
    ...promptState.projectorNotes.map((note) => `- Projector pressure: ${note}`),
    ...promptState.personaStateAdjustmentNotes.map((note) => `- Temporary Persona-state adjustment: ${note}`),
    ...promptState.memoryNotes.map((note) => `- ${note}`),
  ].join("\n");
}

function renderCandidateScene(candidate) {
  return [
    `candidate_id: "${candidate.id}"`,
    `channel: "${escapeYaml(candidate.channelName || candidate.channelId)}"`,
    `year: ${candidate.year}`,
    `length_class: ${candidate.lengthClass}`,
    "features:",
    ...candidate.features.map((feature) => `  - ${feature}`),
    "visible_context_before:",
    ...candidate.before.map((message) => `  - speaker: "${escapeYaml(message.authorName ?? message.authorId)}"\n    content: "${escapeYaml(message.content.trim())}"`),
  ].join("\n");
}

function renderConversationBefore(candidate) {
  return [
    `# Candidate ${candidate.id}`,
    "",
    `Channel: ${candidate.channelName || candidate.channelId}`,
    `Timestamp: ${candidate.target.timestamp}`,
    "",
    "## Before",
    ...candidate.before.map(formatContextLine),
    "",
    "## Target",
    "[withheld from workers; see target.answer.txt]",
  ].join("\n");
}

async function assembleVoidBotPrompt({ outDir, memorySurfacePath, conversationSurfacePath }) {
  const outPath = resolve(outDir, "assembled.md");
  const args = [
    "node_modules/tsx/dist/cli.mjs",
    "scripts/run-repo-face-heartbeats.ts",
    "--assemble-prompt",
    "metame",
    "--out",
    outPath,
    "--memory-surface",
    memorySurfacePath,
    "--conversation-surface",
    conversationSurfacePath,
  ];
  const run = await runCommand(process.execPath, args, { cwd: voidbotRoot, timeoutMs: 240_000 });
  if (run.code !== 0) {
    throw new Error(`VoidBot prompt assembly failed:\n${run.stderr || run.stdout}`);
  }
  return readFile(outPath, "utf8");
}

async function renderProjectedBaseMemorySurface(outRoot) {
  const temp = resolve(outRoot, "_base-projection");
  await mkdir(temp, { recursive: true });
  const outPath = resolve(temp, "assembled.md");
  const args = [
    "node_modules/tsx/dist/cli.mjs",
    "scripts/run-repo-face-heartbeats.ts",
    "--assemble-prompt",
    "metame",
    "--out",
    outPath,
  ];
  const run = await runCommand(process.execPath, args, { cwd: voidbotRoot, timeoutMs: 240_000 });
  if (run.code !== 0) {
    throw new Error(`Base VoidBot prompt assembly failed:\n${run.stderr || run.stdout}`);
  }
  const prompt = await readFile(outPath, "utf8");
  return extractBetween(prompt, "What you remember, feel, and want right now:", "Known human pronoun guidance:").trim();
}

function renderDryBaseMemorySurface() {
  return [
    "Dry-run projected Metame memory surface.",
    "Metame carries public-history memory, social modeling, technical/game-dev salience, and casual Discord texture.",
  ].join("\n");
}

function renderDryAssembledPrompt(memorySurface, conversationSurface) {
  return [
    "# Dry VoidBot Metame Prompt",
    "",
    "What you remember, feel, and want right now:",
    memorySurface,
    "",
    "Recent conversation transcript:",
    conversationSurface,
  ].join("\n");
}

function renderDryTemporaryPersonaState(candidate) {
  const generated = inferTextAffect(candidate.before.map((message) => message.content).join("\n"));
  return [
    "schema_version: weksa.temporary_persona_state_projection.v0",
    "authority: run_scoped_projection_not_canonical",
    "persona:",
    "  id: metame",
    "  canonical_state_ref: E:/Projects/VoidBot/.voidbot/private/personas/metame/metame.cc",
    "scenario:",
    `  candidate_id: "${candidate.id}"`,
    `  channel: "${escapeYaml(candidate.channelName || candidate.channelId)}"`,
    `  year: ${candidate.year}`,
    "affect:",
    `  valence: ${generated.valence}`,
    `  arousal: ${generated.arousal}`,
    `  dominance: ${generated.dominance}`,
    "  labels:",
    ...generated.labels.map((label) => `    - ${label}`),
    "  evidence:",
    "    - dry_run_visible_context_proxy",
    "stance:",
    "  posture: embedded_participant",
    "  social_move_likelihoods:",
    `    - ${guessSpeechAct(candidate)}`,
    "  register_pressure:",
    "    - casual_discord",
    "lowering_pressure:",
    "  should_sound: situated, local, and persona-owned",
    "  should_not_sound: generic assistant commentary",
  ].join("\n");
}

function renderDryFaceTurn(candidate) {
  return [
    "Private thought: This is a dry-run reconstruction of what the visible room seems to be asking for.",
    `Would say: ${candidate.target.content}`,
    "What should stick: The Interpreter should derive intent from the Face turn, not from a direct Weksa packet.",
  ].join("\n");
}

function renderDryInterlingua(candidate) {
  return [
    "interlingua_version: weksa.interlingua.v0",
    `packet_id: metame-swarm-${candidate.id}`,
    "kind: persona_discord_turn_intent",
    "context:",
    "  medium: Discord",
    `  channel: "${escapeYaml(candidate.channelName || candidate.channelId)}"`,
    `  target_message_id: "${candidate.id}"`,
    "discourse:",
    `  speech_act: ${guessSpeechAct(candidate)}`,
    "  intent: respond to the visible room context in Metacrat's pre-2025 Discord register",
    "constraints:",
    "  lowering:",
    "    target_profile: weksa.target_cultural_ontology.en-US.metacrat_casual_pre2025.v0",
  ].join("\n");
}

function renderDryLowering(candidate, job) {
  const variants = [
    candidate.target.content,
    candidate.target.content.replace(/\b(lol|lmao)\b/ig, "").replace(/\s+/g, " ").trim(),
    "yeah that's probably the shape of it",
    "honestly, that tracks",
  ].filter(Boolean);
  const chosen = variants[(job.worker + job.attempt) % variants.length];
  return [
    "schema_version: weksa.persona_culture_lowering_output.v0",
    `candidate_id: "${candidate.id}"`,
    `spoken_text: ${JSON.stringify(chosen)}`,
    "trace:",
    "  activated_affordances:",
    "    - dry_run_swarm_variant",
  ].join("\n");
}

function renderDryOptimization(promptState, phase) {
  const worst = pickHighLoss(phase.runs).slice(0, 3);
  const candidateIds = worst.map((run) => run.candidate_id).filter(Boolean);
  const contract = normalizeOptimizerContract({
    version: 1,
    candidateDiagnoses: worst.map((run) => ({
      candidate_id: run.candidate_id,
      run_id: run.id,
      loss: run.loss,
      failure_labels: ["dry_run_signal"],
      evidence: "Dry optimizer placeholder diagnosis.",
      confidence: 0.7,
    })),
    promptDeltas: [
      {
        surface: "memoryNotes",
        operation: "add",
        note: "Dry optimizer: preserve whether the target is reply-to-other or self-continuation.",
        weight: 0.7,
        evidence_candidate_ids: candidateIds,
        failure_labels: ["dry_run_signal"],
      },
      {
        surface: "interpreterNotes",
        operation: "add",
        note: "Dry optimizer: keep length/register constraints visible when deriving interlingua.",
        weight: 0.7,
        evidence_candidate_ids: candidateIds,
        failure_labels: ["dry_run_signal"],
      },
    ],
    globalHypotheses: worst.map((run) => `High loss on ${run.id} suggests missing local register or length pressure.`),
    doNotDo: [
      "Do not copy answer-key text into culture profiles.",
    ],
  }, phase);
  const applied = applyPromptDeltas(promptState, contract);
  return {
    promptState: applied.promptState,
    contract,
    appliedDeltas: applied.appliedDeltas,
  };
}

async function loadCulturePack(holdouts) {
  const stack = await readFile(resolve(fixtureRoot, "metame-cultural-stack.yaml"), "utf8");
  const profiles = await Promise.all(cultureProfilePaths.map(async (path) => ({
    path,
    text: await readFile(resolve(repoRoot, path), "utf8"),
  })));
  const targetOverlay = await readFile(
    resolve(repoRoot, "data/target-language-ontology/en-US-metacrat-casual-pre2025.yaml"),
    "utf8",
  );
  return {
    stack: redactHoldouts(stack, holdouts),
    profiles,
    targetOverlay,
    profileIds: [
      "weksa.target_cultural_ontology.en-US.metacrat_casual_pre2025.v0",
      ...profiles.map((profile) => readProfileId(profile.text)).filter(Boolean),
    ],
  };
}

async function runCodex(prompt, { job, cwd, logRoot }) {
  const args = [
    "exec",
    "-m",
    process.env.WEKSA_SWARM_MODEL ?? process.env.WEKSA_GOLF_MODEL ?? "gpt-5.4",
    "-c",
    'approval_policy="never"',
    "-c",
    `model_reasoning_effort=${JSON.stringify(process.env.WEKSA_SWARM_REASONING ?? "low")}`,
    "--json",
    "--skip-git-repo-check",
    "-s",
    "read-only",
    "-",
  ];
  const command = process.env.WEKSA_CODEX_EXECUTABLE ?? "C:\\Users\\Meta\\AppData\\Roaming\\npm\\codex.cmd";
  const run = await runCommand(command, args, {
    cwd,
    input: prompt,
    timeoutMs: Number(process.env.WEKSA_SWARM_TIMEOUT_MS ?? 240_000),
  });
  await writeFile(resolve(logRoot, `${sanitizeJob(job)}.stdout.jsonl`), run.stdout, "utf8");
  await writeFile(resolve(logRoot, `${sanitizeJob(job)}.stderr.txt`), run.stderr, "utf8");
  if (run.code !== 0) {
    throw new Error(`Codex generation failed for ${job}:\n${run.stderr || run.stdout}`);
  }
  const text = extractLastCodexAgentMessage(run.stdout).trim();
  if (!text) {
    throw new Error(`Codex generation produced no final text for ${job}.`);
  }
  return text;
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

async function runPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

function loadArchive(path) {
  const store = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(store.messages)) {
    throw new Error(`Archive has no messages array: ${path}`);
  }
  return store;
}

async function loadPriorLedger(outputRootPath) {
  const empty = { strata: {}, features: {} };
  if (!existsSync(outputRootPath)) {
    return empty;
  }
  const entries = await readdir(outputRootPath, { withFileTypes: true }).catch(() => []);
  const summaries = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const summaryPath = resolve(outputRootPath, entry.name, "summary.json");
    if (!existsSync(summaryPath)) {
      continue;
    }
    try {
      summaries.push(JSON.parse(await readFile(summaryPath, "utf8")));
    } catch {
      // Ignore damaged prior run summaries; exploration should not stop on stale smoke.
    }
  }
  const strata = {};
  const features = {};
  for (const summary of summaries) {
    const candidates = Array.isArray(summary.candidates)
      ? summary.candidates
      : summary.candidate ? [summary.candidate] : [];
    if (candidates.length === 0) {
      continue;
    }
    const loss = Number(summary.high_loss_signal?.[0]?.loss ?? summary.phase2?.avg_loss ?? summary.phase1?.avg_loss ?? 0.5);
    for (const candidate of candidates) {
      const stratum = `${candidate.channel_name || candidate.channel_id}:${candidate.length_class}`;
      const current = strata[stratum] ?? { count: 0, totalLoss: 0, avgLoss: 0.5 };
      current.count += 1;
      current.totalLoss += loss;
      current.avgLoss = current.totalLoss / current.count;
      strata[stratum] = current;
      for (const feature of candidate.features ?? []) {
        features[feature] = (features[feature] ?? 0) + 1;
      }
    }
  }
  return { strata, features };
}

async function appendLedger(outputRootPath, summary) {
  await mkdir(outputRootPath, { recursive: true });
  const ledgerPath = resolve(outputRootPath, "ledger.jsonl");
  const lines = summary.candidates.map((candidate) => JSON.stringify({
    run_id: summary.run_id,
    candidate_id: candidate.id,
    channel_name: candidate.channel_name,
    length_class: candidate.length_class,
    phase1_avg_loss: summary.phase1.avg_loss,
    phase2_avg_loss: summary.phase2.avg_loss,
    high_loss: summary.high_loss_signal?.[0]?.loss,
  })).join("\n");
  await writeFile(ledgerPath, `${lines}\n`, { flag: "a" });
}

function summarizePhase(phase) {
  const losses = phase.runs.map((run) => run.loss);
  const f1s = phase.runs.map((run) => run.score.f1);
  return {
    run_count: phase.runs.length,
    avg_loss: round(avg(losses)),
    max_loss: round(Math.max(...losses)),
    min_loss: round(Math.min(...losses)),
    avg_f1: round(avg(f1s)),
    best: [...phase.runs].sort((left, right) => right.score.f1 - left.score.f1).slice(0, 3).map(compactRun),
    worst: [...phase.runs].sort((left, right) => right.loss - left.loss).slice(0, 3).map(compactRun),
  };
}

function pickHighLoss(runs) {
  return [...runs]
    .sort((left, right) => right.loss - left.loss)
    .slice(0, 5)
    .map(compactRun);
}

function compactRun(run) {
  return {
    id: run.id,
    candidate_id: run.candidate?.id,
    worker: run.worker,
    agent: run.agent,
    attempt: run.attempt,
    spoken_text: run.spoken_text,
    temporary_persona_state: run.temporary_persona_state,
    generated_affect: run.generated_affect,
    token_f1: run.score.f1,
    loss: run.loss,
  };
}

function redactedCandidateRecord(candidate) {
  return {
    id: candidate.id,
    timestamp: candidate.target.timestamp,
    channel_id: candidate.channelId,
    channel_name: candidate.channelName,
    year: candidate.year,
    length: candidate.target.content.trim().length,
    length_class: candidate.lengthClass,
    features: candidate.features,
    visible_context_count: candidate.before.length,
    after_context_count: candidate.after.length,
  };
}

function isCandidateTarget(content) {
  const trimmed = content.trim();
  return trimmed.length >= 3 &&
    trimmed.length <= 220 &&
    !/^https?:\/\//i.test(trimmed) &&
    !trimmed.includes("\n```") &&
    !/^>\s{0,3}\w/.test(trimmed) &&
    !/^<@&?\d+>\s*$/i.test(trimmed);
}

function detectFeatures(content, before, targetAuthorId) {
  const text = content.trim();
  const lower = text.toLowerCase();
  const features = [];
  if (text.length <= 80) features.push("short");
  else if (text.length <= 220) features.push("medium");
  else features.push("long");
  if (/\b(lol|lmao|haha|ahaha)\b/i.test(text)) features.push("laugh_marker");
  if (/\b(oof|sorry|my bad)\b/i.test(text)) features.push("repair_or_recoil");
  if (/\b(fuck|shit|damn|ass)\b/i.test(text)) features.push("profanity");
  if (/[?!]$/.test(text)) features.push("terminal_energy");
  if (/^(\w+[, ]+)?(yeah|yep|nah|nope|honestly|i mean|anyway|bro|dude)\b/i.test(text)) features.push("casual_opener");
  if (/<@!?\d+>/.test(text)) features.push("mention");
  if (/\b(engineer|design|game|sound|code|programming|open source|worker|business|non-profit)\b/i.test(text)) features.push("technical_or_political");
  if (before.at(-1)?.authorId && before.at(-1).authorId !== targetAuthorId) features.push("reply_to_other");
  else features.push("self_continuation");
  if (lower.includes("discord")) features.push("discord_meta");
  return [...new Set(features)];
}

function inferTextAffect(content) {
  const text = String(content ?? "");
  const lower = text.toLowerCase();
  const labels = [];
  let valence = 0;
  let arousal = 0.35;
  let dominance = 0.5;
  if (/\b(lol|lmao|haha|ahaha|hehe)\b/i.test(text)) {
    labels.push("amused");
    valence += 0.25;
    arousal += 0.1;
  }
  if (/\b(fuck|shit|damn|ass|bullshit)\b/i.test(text)) {
    labels.push("agitated_or_emphatic");
    valence -= 0.1;
    arousal += 0.25;
    dominance += 0.1;
  }
  if (/\b(oof|sorry|my bad|aw)\b/i.test(text)) {
    labels.push("softened_or_recoiling");
    valence -= 0.05;
    dominance -= 0.1;
  }
  if (/[!?]{1,}$/.test(text.trim()) || /[A-Z]{4,}/.test(text)) {
    labels.push("high_energy");
    arousal += 0.2;
  }
  if (/\b(no|nah|wrong|can't|wont|won't|don't|stop)\b/i.test(text)) {
    labels.push("resistant");
    valence -= 0.15;
    dominance += 0.1;
  }
  if (/\b(yeah|yep|honestly|i mean)\b/i.test(lower)) {
    labels.push("conversational");
  }
  return {
    valence: round(clampNumber(valence, -1, 1)),
    arousal: round(clampNumber(arousal, 0, 1)),
    dominance: round(clampNumber(dominance, 0, 1)),
    labels: labels.length ? [...new Set(labels)] : ["neutral_or_unmarked"],
  };
}

function summarizeTemporaryPersonaState(text) {
  const labels = [];
  const evidence = [];
  let inLabels = false;
  let inEvidence = false;
  for (const line of String(text ?? "").split(/\r?\n/)) {
    if (/^\s*labels:\s*$/.test(line)) {
      inLabels = true;
      inEvidence = false;
      continue;
    }
    if (/^\s*evidence:\s*$/.test(line)) {
      inLabels = false;
      inEvidence = true;
      continue;
    }
    if (/^\S/.test(line)) {
      inLabels = false;
      inEvidence = false;
    }
    const item = /^\s*-\s*(.+?)\s*$/.exec(line)?.[1]?.replace(/^["']|["']$/g, "");
    if (item && inLabels) {
      labels.push(item);
    }
    if (item && inEvidence) {
      evidence.push(item);
    }
  }
  return {
    schema_version: /^schema_version:\s*(.+)$/m.exec(text)?.[1]?.trim(),
    authority: /^authority:\s*(.+)$/m.exec(text)?.[1]?.trim(),
    affect: {
      valence: numberFromField(text, "valence"),
      arousal: numberFromField(text, "arousal"),
      dominance: numberFromField(text, "dominance"),
      labels: labels.slice(0, 8),
      evidence: evidence.slice(0, 4),
    },
    stance: {
      posture: /^  posture:\s*(.+)$/m.exec(text)?.[1]?.trim(),
    },
  };
}

function numberFromField(text, field) {
  const value = new RegExp(`^\\s*${field}:\\s*(-?\\d+(?:\\.\\d+)?)`, "m").exec(text)?.[1];
  return value === undefined ? undefined : Number(value);
}

function guessSpeechAct(candidate) {
  const features = candidate.features;
  if (features.includes("repair_or_recoil")) return "repair_or_playful_recoil";
  if (features.includes("terminal_energy")) return "question_or_exclamation";
  if (features.includes("technical_or_political")) return "technical_or_political_comment";
  if (features.includes("laugh_marker")) return "banter";
  return "contextual_reply";
}

function candidateStratum(candidate) {
  return `${candidate.channelName || candidate.channelId}:${candidate.lengthClass}:${candidate.features.includes("reply_to_other") ? "reply" : "continuation"}`;
}

function extractSpokenText(text) {
  const fenced = text.match(/```(?:yaml)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const match = /^spoken_text:\s*(.+)$/m.exec(body);
  if (!match) {
    return body.trim().split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? "";
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
  return {
    exact_normalized: left === right,
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
  };
}

function normalizeForScore(value) {
  return value
    .toLowerCase()
    .replace(/<@!?\d+>/g, "<mention>")
    .replace(/[*_`~.,!?;:'"()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function extractJsonObject(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error(`Optimizer did not return a JSON object:\n${text}`);
  }
  return JSON.parse(body.slice(start, end + 1));
}

function normalizeOptimizerContract(value, phaseSummary) {
  const runById = new Map((phaseSummary.runs ?? []).map((run) => [run.id, run]));
  const candidateIds = new Set((phaseSummary.runs ?? [])
    .map((run) => run.candidate?.id ?? run.candidate_id)
    .filter(Boolean));
  const candidateDiagnoses = Array.isArray(value.candidateDiagnoses)
    ? value.candidateDiagnoses.map((entry) => normalizeCandidateDiagnosis(entry, { runById, candidateIds })).filter(Boolean)
    : [];
  const promptDeltas = Array.isArray(value.promptDeltas)
    ? value.promptDeltas.map((entry) => normalizePromptDelta(entry, candidateIds)).filter(Boolean)
    : [];
  return {
    schema_version: "weksa.metame_swarm_optimizer_contract.v0",
    version: Number(value.version ?? 1),
    candidateDiagnoses: candidateDiagnoses.slice(0, 12),
    promptDeltas: promptDeltas.slice(0, 16),
    globalHypotheses: normalizeStringArray(value.globalHypotheses).slice(0, 12),
    doNotDo: normalizeStringArray(value.doNotDo).slice(0, 12),
  };
}

function normalizeCandidateDiagnosis(entry, { runById, candidateIds }) {
  if (!entry || typeof entry !== "object") {
    return undefined;
  }
  const runId = stringOrEmpty(entry.run_id ?? entry.runId);
  const run = runById.get(runId);
  const candidateId = stringOrEmpty(entry.candidate_id ?? entry.candidateId ?? run?.candidate_id ?? run?.candidate?.id);
  if (!candidateId || !candidateIds.has(candidateId)) {
    return undefined;
  }
  return {
    candidate_id: candidateId,
    run_id: runId || run?.id,
    loss: clampNumber(entry.loss ?? run?.loss ?? 0, 0, 1),
    failure_labels: normalizeStringArray(entry.failure_labels ?? entry.failureLabels).slice(0, 8),
    evidence: stringOrEmpty(entry.evidence).slice(0, 500),
    confidence: clampNumber(entry.confidence ?? 0, 0, 1),
  };
}

function normalizePromptDelta(entry, candidateIds) {
  if (!entry || typeof entry !== "object") {
    return undefined;
  }
  const surface = stringOrEmpty(entry.surface);
  if (!promptStateKeys.includes(surface)) {
    return undefined;
  }
  const operation = stringOrEmpty(entry.operation || "add").toLowerCase();
  const note = stringOrEmpty(entry.note).slice(0, 500);
  if (!note) {
    return undefined;
  }
  const evidenceCandidateIds = normalizeStringArray(entry.evidence_candidate_ids ?? entry.evidenceCandidateIds)
    .filter((id) => candidateIds.has(id))
    .slice(0, 8);
  return {
    surface,
    operation,
    note,
    weight: clampNumber(entry.weight ?? 0, 0, 1),
    evidence_candidate_ids: evidenceCandidateIds,
    failure_labels: normalizeStringArray(entry.failure_labels ?? entry.failureLabels).slice(0, 8),
  };
}

function applyPromptDeltas(promptState, contract) {
  const next = normalizePromptState(promptState);
  const decisions = [];
  let appliedCount = 0;
  for (const delta of contract.promptDeltas) {
    const decision = {
      ...delta,
      accepted: false,
      reason: "",
    };
    if (delta.operation !== "add") {
      decision.reason = "unsupported_operation";
      decisions.push(decision);
      continue;
    }
    const evidenceCount = new Set(delta.evidence_candidate_ids).size;
    const strongSingle = delta.weight >= 0.85 && evidenceCount >= 1;
    const repeatedSignal = delta.weight >= 0.65 && evidenceCount >= 2;
    if (!strongSingle && !repeatedSignal) {
      decision.reason = "insufficient_weight_or_repeated_evidence";
      decisions.push(decision);
      continue;
    }
    if (next[delta.surface].includes(delta.note)) {
      decision.reason = "duplicate_note";
      decisions.push(decision);
      continue;
    }
    next[delta.surface] = [delta.note, ...next[delta.surface]];
    decision.accepted = true;
    decision.reason = repeatedSignal ? "accepted_repeated_signal" : "accepted_strong_single_candidate";
    appliedCount += 1;
    decisions.push(decision);
  }
  return {
    promptState: normalizePromptState({
      ...next,
      version: appliedCount > 0 ? next.version + 1 : next.version,
    }),
    appliedDeltas: decisions,
  };
}

function normalizePromptState(state) {
  return {
    version: Number(state.version ?? 1),
    projectorNotes: normalizeStringArray(state.projectorNotes).slice(0, 12),
    memoryNotes: normalizeStringArray(state.memoryNotes).slice(0, 12),
    faceNotes: normalizeStringArray(state.faceNotes).slice(0, 12),
    interpreterNotes: normalizeStringArray(state.interpreterNotes).slice(0, 12),
    loweringNotes: normalizeStringArray(state.loweringNotes).slice(0, 16),
    cultureNotes: normalizeStringArray(state.cultureNotes).slice(0, 12),
    personaStateAdjustmentNotes: normalizeStringArray(state.personaStateAdjustmentNotes).slice(0, 12),
    hypotheses: normalizeStringArray(state.hypotheses).slice(0, 12),
    doNotDo: normalizeStringArray(state.doNotDo).slice(0, 12),
  };
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
}

function stringOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.min(max, Math.max(min, number));
}

function redactHoldout(text, holdout) {
  let redacted = text;
  const variants = [
    holdout,
    holdout.replace(/\*/g, ""),
    normalizeForScore(holdout),
  ].filter(Boolean);
  for (const variant of variants) {
    redacted = redacted.split(variant).join("[held-out target redacted]");
  }
  return redacted;
}

function redactHoldouts(text, holdouts) {
  return holdouts.reduce((current, holdout) => redactHoldout(current, holdout), text);
}

function readProfileId(text) {
  const match = /^profile_id:\s*(.+)$/m.exec(text);
  return match ? match[1].trim() : undefined;
}

function formatContextLine(message) {
  return `[${message.timestamp}] ${message.authorName ?? message.authorId}: ${message.content.trim()}`;
}

function classifyLength(length) {
  if (length <= 80) return "short";
  if (length <= 220) return "medium";
  return "long";
}

function timestampMs(message) {
  return Date.parse(typeof message === "string" ? message : message.timestamp);
}

function yearOf(timestamp) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? String(date.getUTCFullYear()) : "unknown";
}

function compareByTimestamp(left, right) {
  return timestampMs(left) - timestampMs(right) || String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

function createRandom(seedText) {
  let value = 2166136261;
  for (const character of seedText) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6d2b79f5;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function escapeYaml(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n");
}

function sanitizeJob(value) {
  return value.replace(/[^A-Za-z0-9_.-]+/g, "_");
}

function extractBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Could not extract section ${startMarker}`);
  }
  return text.slice(start + startMarker.length, end);
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value) {
  return Number(value.toFixed(3));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--real":
        parsed.real = true;
        break;
      case "--workers":
        parsed.workers = args[index + 1];
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
      case "--seed":
        parsed.seed = args[index + 1];
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
      case "--archive":
        parsed.archive = args[index + 1];
        index += 1;
        break;
      case "--author-id":
        parsed.authorId = args[index + 1];
        index += 1;
        break;
      case "--before":
        parsed.before = args[index + 1];
        index += 1;
        break;
      case "--adjacency-minutes":
        parsed.adjacencyMinutes = args[index + 1];
        index += 1;
        break;
      case "--message-id":
        parsed.messageId = args[index + 1];
        index += 1;
        break;
      case "--max-candidates":
        parsed.maxCandidates = args[index + 1];
        index += 1;
        break;
      case "--initial-prompt-state":
        parsed.initialPromptState = args[index + 1];
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}
