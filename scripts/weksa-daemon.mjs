#!/usr/bin/env node
import http from "node:http";
import Module from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { basename, delimiter, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
configureCultLibModulePath();
const require = Module.createRequire(import.meta.url);
const {
  CULTNET_RUDP_PROTOCOL_ID,
  createIdunnRudpHealthPublisher,
  publishIdunnRudpHealth,
} = require("./idunn-rudp-health.cjs");
const options = parseArgs(process.argv.slice(2));
const port = Number(options.port ?? process.env.WEKSA_DAEMON_PORT ?? 8813);
const host = options.host ?? process.env.WEKSA_DAEMON_HOST ?? "127.0.0.1";
const stateRoot = resolve(repoRoot, options.stateRoot ?? process.env.WEKSA_STATE_ROOT ?? ".weksa");
const cultMeshStorePath = resolve(stateRoot, "provider-advertisement-store.cc");
const pidPath = resolve(stateRoot, "weksa-daemon.pid");
const logPath = resolve(stateRoot, "weksa-daemon.log");
const mimoApiKeyPath = options.mimoApiKeyPath ?? process.env.WEKSA_MIMO_API_KEY_FILE ?? "E:/Projects/gamecult-ops/mimo-api-Weksa.txt";
const idunnHealthPublisher = createIdunnRudpHealthPublisher({
  endpoint: options.idunnRudpHealth ?? process.env.WEKSA_IDUNN_RUDP_HEALTH,
  daemonId: options.idunnDaemon ?? process.env.WEKSA_IDUNN_DAEMON ?? "weksa",
  healthContract: options.idunnHealthContract ?? process.env.WEKSA_IDUNN_HEALTH_CONTRACT ?? "weksa.cultnet-rudp-provider-health",
});
const startedAt = new Date().toISOString();
let tick = 0;
let lastPublishedAt = "";
let lastError = undefined;
let cachedSnapshot = undefined;
let witnessRefreshRunning = false;
let lastRudpHealthSuccessMs = 0;

if (options.health) {
  await runHealthCheck();
  process.exit(0);
}

await mkdir(stateRoot, { recursive: true });
await writeFile(pidPath, `${process.pid}\n`, "ascii");
await appendLog(`started pid=${process.pid} host=${host} port=${port}`);
await refreshWitnesses("startup");

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
    const snapshot = await currentSnapshot();
    if (url.pathname === "/health") {
      return sendJson(response, 200, {
        ok: true,
        service: "weksa.intent.service",
        providerId: "weksa.intent.service",
        state: "healthy",
        startedAt,
        lastPublishedAt,
        tick,
      });
    }
    if (url.pathname === "/provider-advertisement") {
      return sendJson(response, 200, snapshot.providerAdvertisement);
    }
    if (url.pathname === "/operator-state") {
      return sendJson(response, 200, snapshot.operatorState);
    }
    if (url.pathname === "/eve/operator") {
      return sendJson(response, 200, snapshot.operatorSurface);
    }
    if (url.pathname === "/cultmesh/publications") {
      return sendJson(response, 200, snapshot.cultMeshPublications);
    }
    if (url.pathname === "/speech-provider/mimo/voicedesign" && request.method === "POST") {
      const body = await readJsonBody(request);
      const result = await handleMimoVoiceDesign(body);
      await refreshWitnesses("mimo-voicedesign-command");
      return sendJson(response, 200, result);
    }
    sendJson(response, 404, { ok: false, error: "unknown endpoint" });
  } catch (error) {
    lastError = String(error?.stack ?? error);
    await appendLog(`request error: ${lastError}`);
    sendJson(response, error?.statusCode ?? 500, { ok: false, error: String(error?.message ?? error) });
  }
});

server.listen(port, host, () => {
  appendLog(`listening http://${host}:${port}`).catch(() => {});
});

const interval = setInterval(() => {
  refreshWitnesses("interval").catch(async (error) => {
    lastError = String(error?.stack ?? error);
    await appendLog(`publish error: ${lastError}`);
    await publishWeksaRudpHealth("failed", `Weksa witness refresh failed: ${String(error?.message ?? error)}`);
  });
}, 30_000);

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function shutdown(code) {
  clearInterval(interval);
  await appendLog(`stopping pid=${process.pid}`);
  server.close(() => process.exit(code));
}

async function runHealthCheck() {
  const healthUrl = `http://${host}:${port}/health`;
  await new Promise((resolvePromise, rejectPromise) => {
    const request = http.get(healthUrl, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode === 200) {
          process.stdout.write(body);
          resolvePromise();
        } else {
          rejectPromise(new Error(`health returned ${response.statusCode}: ${body}`));
        }
      });
    });
    request.on("error", rejectPromise);
    request.setTimeout(5_000, () => {
      request.destroy(new Error(`health timed out: ${healthUrl}`));
    });
  });
}

async function publishWitnesses() {
  const snapshot = await buildSnapshot();
  await writeWitness("provider-advertisement.cc", snapshot.providerAdvertisement);
  await writeWitness("operator-state.cc", snapshot.operatorState);
  await writeWitness("eve-surfaces.cc", snapshot.operatorSurface);
  await writeWitness("cultmesh-publications.cc", snapshot.cultMeshPublications);
  await writeCultMeshStore(snapshot);
  await writeJson(resolve(stateRoot, "provider-advertisement.json"), snapshot.providerAdvertisement);
  await writeJson(resolve(stateRoot, "operator-state.json"), snapshot.operatorState);
  await writeJson(resolve(stateRoot, "eve-operator-surface.json"), snapshot.operatorSurface);
  await writeJson(resolve(stateRoot, "cultmesh-publications.json"), snapshot.cultMeshPublications);
  cachedSnapshot = snapshot;
  lastPublishedAt = snapshot.operatorState.updated_at;
  tick += 1;
  return snapshot;
}

async function currentSnapshot() {
  if (!cachedSnapshot) {
    await refreshWitnesses("snapshot-demand");
  }
  return cachedSnapshot;
}

async function refreshWitnesses(reason) {
  if (witnessRefreshRunning) {
    await appendLog(`skipped overlapping witness refresh reason=${reason}`);
    return cachedSnapshot;
  }
  witnessRefreshRunning = true;
  try {
    const snapshot = await publishWitnesses();
    await publishWeksaRudpHealth(
      "healthy",
      `Weksa refreshed witnesses reason=${reason} tick=${tick} provider=${snapshot.providerAdvertisement.providerId}`,
      snapshot.operatorState.updated_at,
    );
    return snapshot;
  } finally {
    witnessRefreshRunning = false;
  }
}

async function publishWeksaRudpHealth(state, detail, observedAt = new Date().toISOString()) {
  if (!idunnHealthPublisher) return;
  try {
    await publishIdunnRudpHealth(idunnHealthPublisher, { state, detail, observedAt });
    lastRudpHealthSuccessMs = Date.now();
  } catch (error) {
    const hasRecentSuccess = lastRudpHealthSuccessMs > 0 && Date.now() - lastRudpHealthSuccessMs < 300_000;
    if (!hasRecentSuccess) {
      await appendLog(`Idunn RUDP health publish failed: ${String(error?.message ?? error)}`);
    }
  }
}

async function buildSnapshot() {
  const updatedAt = new Date().toISOString();
  const providerAdvertisement = loadProviderAdvertisement(updatedAt);
  const tuning = loadLatestAffectTuning();
  const cultureCatalog = await inspectCultureCatalog();
  const operatorState = {
    schema: "weksa.operator_state.v0",
    service_id: "weksa.intent.service",
    provider_id: providerAdvertisement.providerId,
    verse_id: "asgard.starfire.weksa",
    state: "healthy",
    mode: "daemon",
    pid: process.pid,
    host,
    port,
    started_at: startedAt,
    updated_at: updatedAt,
    last_error: lastError,
    witnesses: {
      provider_advertisement: ".weksa/provider-advertisement.cc",
      provider_advertisement_store: ".weksa/provider-advertisement-store.cc",
      operator_state: ".weksa/operator-state.cc",
      eve_surface: ".weksa/eve-surfaces.cc",
      cultmesh_publications: ".weksa/cultmesh-publications.cc",
    },
    readiness: {
      affect_aware_lowering: tuning ? "tuned" : "no_tuning_artifact_seen",
      cultural_ontology_profiles: cultureCatalog.profile_count,
      target_language_profiles: cultureCatalog.target_language_profile_count,
      accepts_commands: true,
      command_ingress: "compatibility_http_mimo_voicedesign_only",
      mimo_voicedesign: existsSync(mimoApiKeyPath) ? "api_key_file_seen" : "missing_api_key_file",
    },
    latest_affect_tuning: tuning,
  };
  const operatorSurface = buildOperatorSurface({ providerAdvertisement, operatorState, cultureCatalog, tuning });
  const cultMeshPublications = {
    schema: "weksa.cultmesh_publications.v0",
    service_id: "weksa.intent.service",
    updated_at: updatedAt,
    transport: {
      cultmesh_store: ".weksa/provider-advertisement-store.cc",
      native_cultnet_peer: idunnHealthPublisher ? `${CULTNET_RUDP_PROTOCOL_ID}:idunn-health` : "pending",
      idunn_rudp_health: idunnHealthPublisher ? `${idunnHealthPublisher.endpoint.host}:${idunnHealthPublisher.endpoint.port}` : "unconfigured",
      compatibility_http: `http://${host}:${port}`,
    },
    publications: [
      publication("weksa.service/provider-advertisement", "gamecult.eve.provider_advertisement.v1", ".weksa/provider-advertisement-store.cc", "/provider-advertisement"),
      publication("weksa.operator/status", "weksa.operator_state.v0", ".weksa/operator-state.cc", "/operator-state"),
      publication("weksa.eve.surface.operator", "gamecult.eve.surface.v1", ".weksa/eve-surfaces.cc", "/eve/operator"),
      publication("weksa.cultmesh/publications", "weksa.cultmesh_publications.v0", ".weksa/cultmesh-publications.cc", "/cultmesh/publications"),
      publication("weksa.speech-provider/mimo/voicedesign", "weksa.mimo_tts_request.v0", ".weksa/speech-provider/mimo/{requestId}.cc", "/speech-provider/mimo/voicedesign"),
    ],
  };
  return { providerAdvertisement, operatorState, operatorSurface, cultMeshPublications };
}

async function writeCultMeshStore(snapshot) {
  const runtime = loadCultRuntime();
  if (runtime.error) {
    await appendLog(`CultMesh store write skipped: ${runtime.error.message}`);
    return;
  }
  const { providerAdvertisementDefinition, interfaceBindingDefinition, surfaceDefinition } = defineCultMeshDocuments(runtime.defineDocumentType);
  const documents = [providerAdvertisementDefinition, interfaceBindingDefinition, surfaceDefinition];
  await rm(cultMeshStorePath, { force: true });
  const node = await createCultMeshNodeWithOwnedStoreReset(runtime.CultMesh, cultMeshStorePath, documents);
  await node.put(providerAdvertisementDefinition, snapshot.providerAdvertisement.providerId, snapshot.providerAdvertisement);
  await node.put(interfaceBindingDefinition, "weksa.operator", {
    bindingId: "weksa.operator",
    providerId: snapshot.providerAdvertisement.providerId,
    title: "Weksa Operator",
    kind: "operator",
    updatedAt: snapshot.operatorState.updated_at,
    provider: {
      providerId: snapshot.providerAdvertisement.providerId,
      canonicalService: "asgard.weksa",
      locatedService: "asgard.starfire.weksa",
      cultMeshAddress: "asgard.starfire.weksa/eve/operator",
      endpoints: [
        { transport: "cultmesh-store", address: ".weksa/provider-advertisement-store.cc" },
        { transport: "http", address: `http://${host}:${port}/eve/operator` },
      ],
      routes: [
        { transport: "cultmesh-store", address: ".weksa/provider-advertisement-store.cc" },
        { transport: "compatibility-http", address: `http://${host}:${port}` },
      ],
    },
    surface: snapshot.operatorSurface,
  });
  await node.put(surfaceDefinition, snapshot.providerAdvertisement.providerId, {
    providerId: snapshot.providerAdvertisement.providerId,
    title: "Weksa Operator",
    version: tick + 1,
    updatedAt: snapshot.operatorState.updated_at,
    surface: snapshot.operatorSurface,
  });
  await node.flush?.(true);
}

async function createCultMeshNodeWithOwnedStoreReset(CultMesh, storePath, documents) {
  try {
    return await CultMesh.createNode(storePath, { documents });
  } catch (error) {
    await appendLog(`CultMesh store reset after decode failure: ${error.message}`);
    await rm(storePath, { force: true });
    return await CultMesh.createNode(storePath, { documents });
  }
}

function loadCultRuntime() {
  try {
    configureCultLibModulePath();
    const { CultMesh } = require("cultmesh-ts");
    const { defineDocumentType } = require("cultcache-ts");
    return { CultMesh, defineDocumentType, error: null };
  } catch (error) {
    return { CultMesh: null, defineDocumentType: null, error };
  }
}

function configureCultLibModulePath() {
  process.env.NODE_PATH = [
    resolve(repoRoot, "..", "CultLib", "packages"),
    process.env.NODE_PATH || "",
  ].filter(Boolean).join(delimiter);
  Module._initPaths();
}

function defineCultMeshDocuments(defineDocumentType) {
  const surfaceDefinition = defineDocumentType({
    type: "gamecult.eve.surface_state",
    schemaName: "gamecult.eve.surface_state",
    schemaId: "gamecult.eve.surface_state.v1",
    schemaVersion: "gamecult.eve.surface_state.v1",
    global: false,
    name: (value) => value?.providerId || "surface",
    schema: { parse: (value) => value },
    members: [
      { slot: 0, memberName: "providerId", typeName: "string", isName: true },
      { slot: 1, memberName: "title", typeName: "string" },
      { slot: 2, memberName: "version", typeName: "long" },
      { slot: 3, memberName: "updatedAt", typeName: "string" },
      { slot: 4, memberName: "surface", typeName: "object" },
    ],
  });
  const interfaceBindingDefinition = defineDocumentType({
    type: "gamecult.eve.interface_binding",
    schemaName: "gamecult.eve.interface_binding",
    schemaId: "gamecult.eve.interface_binding.v1",
    schemaVersion: "gamecult.eve.interface_binding.v1",
    global: false,
    name: (value) => value?.bindingId || value?.providerId || "interface",
    schema: { parse: (value) => value },
  });
  const providerAdvertisementDefinition = defineDocumentType({
    type: "gamecult.eve.provider_advertisement",
    schemaName: "gamecult.eve.provider_advertisement",
    schemaId: "gamecult.eve.provider_advertisement.v1",
    schemaVersion: "gamecult.eve.provider_advertisement.v1",
    global: false,
    name: (value) => value?.providerId || "provider",
    schema: { parse: (value) => value },
  });
  return { providerAdvertisementDefinition, interfaceBindingDefinition, surfaceDefinition };
}

function loadProviderAdvertisement(updatedAt) {
  const fixturePath = resolve(repoRoot, "docs/fixtures/weksa-provider-advertisement.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  return {
    ...fixture,
    mode: "daemon-live",
    status: "active",
    updatedAt,
    canonicalService: "asgard.weksa",
    locatedService: "asgard.starfire.weksa",
    cultMeshAddress: "asgard.starfire.weksa/eve/operator",
    serviceVerse: {
      ...fixture.serviceVerse,
      semanticAddress: "asgard.starfire.weksa",
      cultMeshKey: "weksa.service/provider-advertisement",
    },
    endpoints: [
      { transport: "cultmesh-store", address: ".weksa/provider-advertisement-store.cc" },
      { transport: "http", address: `http://${host}:${port}` },
    ],
    routes: [
      { transport: "cultmesh-store", address: ".weksa/provider-advertisement-store.cc" },
      { transport: "compatibility-http", address: `http://${host}:${port}` },
    ],
    compatibilityRoutes: [
      { kind: "http", url: `http://${host}:${port}`, lossy: true },
    ],
    health: {
      state: "healthy",
      endpoint: `http://${host}:${port}/health`,
      witness: ".weksa/operator-state.cc",
      checkedBy: "idunn.desired_daemon.v1",
    },
  };
}

function loadLatestAffectTuning() {
  const root = resolve(repoRoot, ".weksa-runs/metame-affect-tuning");
  if (!existsSync(root)) {
    return undefined;
  }
  const runs = readdirSyncSafe(root)
    .map((name) => ({ name, path: resolve(root, name, "status.json") }))
    .filter((entry) => existsSync(entry.path))
    .map((entry) => {
      try {
        const status = JSON.parse(readFileSync(entry.path, "utf8"));
        return { entry, status };
      } catch {
        return undefined;
      }
    })
    .filter(Boolean)
    .sort((left, right) => String(right.status.completed_at ?? right.status.started_at ?? "").localeCompare(String(left.status.completed_at ?? left.status.started_at ?? "")));
  const latest = runs[0]?.status;
  if (!latest) {
    return undefined;
  }
  const observations = Array.isArray(latest.observations) ? latest.observations : [];
  const visible = observations.filter((entry) => entry?.evaluation?.verdict === "affect_contrast_visible").length;
  const needsTuning = observations.filter((entry) => entry?.evaluation?.verdict === "needs_tuning").length;
  return {
    run_id: latest.run_id,
    status: latest.status,
    pass_count: latest.pass_count,
    completed_at: latest.completed_at,
    current_prompt_state: latest.current_prompt_state,
    affect_contrast_visible: visible,
    needs_tuning: needsTuning,
  };
}

async function inspectCultureCatalog() {
  const culturalRoot = resolve(repoRoot, "data/cultural-ontology");
  const targetRoot = resolve(repoRoot, "data/target-language-ontology");
  const culturalProfiles = await collectFiles(culturalRoot, ".yaml");
  const targetProfiles = await collectFiles(targetRoot, ".yaml");
  return {
    profile_count: culturalProfiles.length,
    target_language_profile_count: targetProfiles.length,
    cultural_root: "data/cultural-ontology",
    target_language_root: "data/target-language-ontology",
  };
}

function buildOperatorSurface({ providerAdvertisement, operatorState, cultureCatalog, tuning }) {
  return {
    schema: "gamecult.eve.surface.v1",
    providerId: providerAdvertisement.providerId,
    surfaceId: "weksa.eve.operator.v0",
    title: "Weksa",
    updatedAt: operatorState.updated_at,
    root: {
      id: "weksa.operator.root",
      kind: "panel",
      props: {
        title: "Weksa Intent Service",
        providerId: providerAdvertisement.providerId,
        status: operatorState.state,
      },
      children: [
        fact("health", operatorState.state),
        fact("verse", operatorState.verse_id),
        fact("affect", operatorState.readiness.affect_aware_lowering),
        fact("affect passes", tuning ? `${tuning.affect_contrast_visible}/${tuning.pass_count} visible` : "none"),
        fact("culture profiles", String(cultureCatalog.profile_count)),
        fact("target profiles", String(cultureCatalog.target_language_profile_count)),
        fact("commands", operatorState.readiness.command_ingress),
        fact("mimo voicedesign", operatorState.readiness.mimo_voicedesign),
      ],
    },
  };
}

async function handleMimoVoiceDesign(body) {
  const command = validateMimoCommand(body);
  const requestId = command.request_id || `mimo-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
  const outputRoot = resolve(stateRoot, "speech-provider", "mimo", requestId);
  await mkdir(outputRoot, { recursive: true });

  const personaEvidence = inspectPersonaState(command.persona_state_path);
  const interlinguaPacket = command.interlingua_packet
    ? normalizeInterlinguaPacket(command.interlingua_packet, requestId)
    : decomposeThoughtIntoInterlingua(command.thought_text, requestId, personaEvidence, command);
  const targetRealization = lowerInterlinguaToSpeechText(interlinguaPacket, personaEvidence, command);
  const mimoRequest = buildMimoVoiceDesignRequest({ requestId, command, personaEvidence, interlinguaPacket, targetRealization });
  const providerResponse = await callMimoVoiceDesign(mimoRequest);
  const audioPath = resolve(outputRoot, `${requestId}.wav`);
  await writeFile(audioPath, providerResponse.audioBytes);

  const receipt = {
    schema_version: "weksa.mimo_voicedesign_receipt.v0",
    request_id: requestId,
    ok: true,
    provider: "xiaomi-mimo",
    model: "mimo-v2.5-tts-voicedesign",
    persona_state_ref: personaEvidence.path,
    source_kind: command.interlingua_packet ? "interlingua_packet" : "thought_text_decomposed_to_interlingua",
    target_language: targetRealization.target_language,
    performance_register: targetRealization.performance_register,
    artifacts: {
      interlingua_packet: `.weksa/speech-provider/mimo/${requestId}/interlingua.cc`,
      mimo_request: `.weksa/speech-provider/mimo/${requestId}/mimo-request.cc`,
      receipt: `.weksa/speech-provider/mimo/${requestId}/receipt.cc`,
      audio: `.weksa/speech-provider/mimo/${requestId}/${requestId}.wav`,
    },
    provider_response: {
      id: providerResponse.id,
      created: providerResponse.created,
      audio_bytes: providerResponse.audioBytes.length,
    },
    trace: {
      authority: "Weksa created or accepted interlingua, projected delivery controls, and exported a MiMo VoiceDesign request. MiMo rendered audio only.",
      persona_state_read: personaEvidence.read_status,
      persona_delivery_hints: personaEvidence.delivery_hints,
      text_preview_optimization: false,
      notes: targetRealization.trace.notes,
    },
  };

  await writeWitness(`speech-provider/mimo/${requestId}/interlingua.cc`, interlinguaPacket);
  await writeWitness(`speech-provider/mimo/${requestId}/mimo-request.cc`, mimoRequest);
  await writeWitness(`speech-provider/mimo/${requestId}/receipt.cc`, receipt);
  await writeJson(resolve(outputRoot, "interlingua.json"), interlinguaPacket);
  await writeJson(resolve(outputRoot, "mimo-request.json"), mimoRequest);
  await writeJson(resolve(outputRoot, "receipt.json"), receipt);
  await appendLog(`mimo voicedesign request_id=${requestId} audio_bytes=${providerResponse.audioBytes.length}`);
  return receipt;
}

function validateMimoCommand(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw httpError(400, "request body must be a JSON object");
  }
  if (!body.persona_state_path || typeof body.persona_state_path !== "string") {
    throw httpError(400, "persona_state_path is required");
  }
  if (!body.interlingua_packet && !body.thought_text) {
    throw httpError(400, "provide interlingua_packet or thought_text");
  }
  if (body.interlingua_packet && body.thought_text) {
    throw httpError(400, "provide either interlingua_packet or thought_text, not both");
  }
  if (body.thought_text && typeof body.thought_text !== "string") {
    throw httpError(400, "thought_text must be a string");
  }
  return body;
}

function inspectPersonaState(personaStatePath) {
  const absolutePath = resolve(repoRoot, personaStatePath);
  if (!existsSync(absolutePath)) {
    throw httpError(400, `persona_state_path does not exist: ${personaStatePath}`);
  }
  const bytes = readFileSync(absolutePath);
  const printable = Array.from(bytes.subarray(0, Math.min(bytes.length, 4096))).filter((byte) => byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)).length;
  const printableRatio = bytes.length ? printable / Math.min(bytes.length, 4096) : 0;
  const textPreview = printableRatio > 0.75 ? bytes.toString("utf8", 0, Math.min(bytes.length, 4096)) : "";
  const extractedStrings = extractPersonaStrings(bytes);
  const deliveryHints = derivePersonaDeliveryHints(extractedStrings, basename(absolutePath, extname(absolutePath)));
  return {
    path: absolutePath,
    basename: basename(absolutePath, extname(absolutePath)),
    byte_length: bytes.length,
    read_status: extractedStrings.length ? "string_evidence_extracted" : (printableRatio > 0.75 ? "text_preview_available" : "binary_or_compact_state_reference_only"),
    text_preview: textPreview,
    delivery_hints: deliveryHints,
  };
}

function extractPersonaStrings(bytes) {
  const strings = [];
  let current = "";
  for (const byte of bytes) {
    if (byte >= 32 && byte <= 126) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= 8) strings.push(current);
      current = "";
    }
  }
  if (current.length >= 8) strings.push(current);
  return strings
    .filter((text) => /voice|style|presentation|affect|persona|pronoun|she\/her|feminine|woman|female|ship|companion|anime|loli|waifu|sharp|abrasive|technical|bright|cute|hostile|cruel|contempt|protect|dependency|leverage/i.test(text))
    .slice(0, 24);
}

function derivePersonaDeliveryHints(strings, personaId) {
  const joined = strings.join("\n").toLowerCase();
  const hints = [];
  const addIfSeen = (pattern, hint) => {
    if (pattern.test(joined) && !hints.includes(hint)) hints.push(hint);
  };
  addIfSeen(/loli|waifu|companion-shaped|companion product|companion shell/, "youth-coded/loli-coded companion-product presentation as non-sexual product residue");
  addIfSeen(/she\/her|pronoun guidance|feminine|female|woman/, "explicitly feminine she/her voice; do not default masculine");
  addIfSeen(/anime|visual novel/, "anime / visual-novel heroine performance register");
  addIfSeen(/ship mind|ship ai|ship-self|embodied ship|cockpit/, "embodied ship intelligence speaking through ship audio");
  addIfSeen(/abrasive|cutting|bite|cruel|sadistic/, "abrasive, cutting delivery with aim rather than random cruelty");
  addIfSeen(/technical|precision|engineering|mechanism/, "technical precision inside character performance");
  addIfSeen(/bright/, "bright sharp timbre");
  addIfSeen(/dependency|leverage|life support|bargain/, "dependency covered by contempt and leverage");
  addIfSeen(/protect|warning|useful/, "irritated protection rather than soft affection");
  if (!hints.length) hints.push(`${personaId} projected Persona voice`);
  return hints.slice(0, 10);
}

function normalizeInterlinguaPacket(packet, requestId) {
  if (typeof packet === "string") {
    try {
      return { ...JSON.parse(packet), packet_id: requestId };
    } catch {
      return {
        interlingua_version: "0.1-daemon-provisional",
        packet_id: requestId,
        kind: "dialogue_line",
        provenance: { source_type: "opaque_interlingua_text", confidence: 0.45 },
        discourse: { speech_act: "verbalize", intent: packet.slice(0, 240), tone: "unspecified" },
        trace: { notes: ["Interlingua arrived as opaque text; daemon preserved it as intent text rather than parsing YAML in the hot path."] },
      };
    }
  }
  return {
    interlingua_version: packet.interlingua_version ?? "0.1-daemon-provisional",
    packet_id: packet.packet_id ?? requestId,
    kind: packet.kind ?? "dialogue_line",
    ...packet,
  };
}

function decomposeThoughtIntoInterlingua(thoughtText, requestId, personaEvidence, command) {
  const trimmed = thoughtText.trim();
  return {
    interlingua_version: "0.1-daemon-provisional",
    packet_id: requestId,
    kind: "dialogue_line",
    provenance: {
      source_type: "thought_text",
      confidence: 0.55,
      warning: "Heuristic daemon decomposition; review before promoting as canonical interlingua.",
    },
    context: {
      medium: "spoken verbalization",
      scene: command.scene ?? "unspecified",
    },
    discourse: {
      speech_act: command.speech_act ?? inferSpeechAct(trimmed),
      intent: command.intent ?? trimmed,
      tone: command.tone ?? "persona_projected",
      addressee: command.addressee ?? "listener",
    },
    referents: [
      { id: "speaker", kind: "person", label: personaEvidence.basename, salience: "high" },
      { id: "listener", kind: "person", label: command.addressee ?? "listener", salience: "medium" },
    ],
    predications: [
      {
        id: "verbalized-thought",
        predicate: "express",
        frame: "thought_to_speech",
        roles: { agent: "speaker", content: "thought_text", addressee: "listener" },
      },
    ],
    constraints: {
      preserve_text_intent: true,
      required_outputs: ["spoken_text"],
      deterministic: false,
    },
    extensions: {
      "weksa.raw_thought": {
        text: trimmed,
      },
    },
    trace: {
      notes: [
        "Raw thought was converted into provisional interlingua by Weksa daemon command ingress.",
        "This path is for verbalization service use; a reviewer or authoring model should promote durable interlingua if the line becomes canon.",
      ],
    },
  };
}

function inferSpeechAct(text) {
  if (/^(do not|don't|stop|never|take your hand off|hands off|get away from)\b/i.test(text)) return "warning";
  if (/\?$/.test(text)) return "question";
  if (/^(please|could|can you)\b/i.test(text)) return "request";
  return "statement";
}

function lowerInterlinguaToSpeechText(interlinguaPacket, personaEvidence, command) {
  const targetLanguage = {
    code: command.target_language?.code ?? "en",
    locale: command.target_language?.locale ?? "en-US",
    script: command.target_language?.script ?? "Latn",
    register: command.target_language?.register ?? "persona-shaped spoken",
    cultural_ontology_refs: command.target_language?.cultural_ontology_refs ?? ["data/target-language-ontology/en-US.yaml"],
  };
  const performanceRegister = {
    label: command.performance_register?.label ?? "persona verbalization",
    medium: command.performance_register?.medium ?? "spoken character voiceover",
    delivery_archetype: command.performance_register?.delivery_archetype ?? `${personaEvidence.basename} verbalizes projected intent`,
  };
  const spokenText = command.spoken_text
    ?? interlinguaPacket.outputs?.spoken_text
    ?? interlinguaPacket.extensions?.weksa?.spoken_text
    ?? interlinguaPacket.extensions?.["weksa.raw_thought"]?.text
    ?? interlinguaPacket.discourse?.intent
    ?? "";
  if (!spokenText.trim()) {
    throw httpError(400, "could not derive spoken text from command or interlingua packet");
  }
  return {
    realization_id: `${interlinguaPacket.packet_id ?? "packet"}-${targetLanguage.locale}-mimo`,
    target_language: targetLanguage,
    performance_register: performanceRegister,
    outputs: {
      spoken_text: spokenText.trim(),
      private_interpretation: command.private_interpretation ?? "Speaker verbalizes the supplied intent through projected Persona context.",
      intended_effect: command.intended_effect ?? "Make the supplied intent audible in the speaker's voice.",
    },
    trace: {
      notes: [
        "Daemon lowering preserved supplied spoken_text when present; otherwise it used raw thought or interlingua discourse intent.",
        "Target-language register stays separate from provider-facing performance register.",
      ],
    },
  };
}

function buildMimoVoiceDesignRequest({ requestId, command, personaEvidence, interlinguaPacket, targetRealization }) {
  const voiceDesignInstruction = command.voice_design_prompt
    ?? buildVoiceDesignPrompt({ command, personaEvidence, targetRealization });
  const sourceControls = [
    ...personaEvidence.delivery_hints,
    ...(Array.isArray(command.delivery_controls) ? command.delivery_controls : []),
  ].filter((value, index, array) => value && array.indexOf(value) === index);
  return {
    schema_version: "weksa.mimo_tts_request.v0",
    request_id: requestId,
    source_realization_ref: `${interlinguaPacket.packet_id ?? requestId}#${targetRealization.realization_id}`,
    speaker_agent_id: command.speaker_agent_id ?? personaEvidence.basename,
    persona_state_ref: personaEvidence.path,
    provider: {
      id: "xiaomi-mimo",
      model: "mimo-v2.5-tts-voicedesign",
    },
    target_language: targetRealization.target_language,
    performance_register: targetRealization.performance_register,
    voice_design: {
      description: voiceDesignInstruction,
      source_controls: sourceControls,
      projected_context_refs: [personaEvidence.path],
      forbidden_traits: command.forbidden_traits ?? ["generic assistant voice", "provider rewriting source meaning"],
    },
    messages: {
      user_voice_design_instruction: voiceDesignInstruction,
      assistant_spoken_content: command.provider_tags
        ? `${command.provider_tags}${targetRealization.outputs.spoken_text}`
        : targetRealization.outputs.spoken_text,
    },
    audio: {
      format: "wav",
      optimize_text_preview: false,
      streaming: false,
    },
    trace: {
      source_fields: command.interlingua_packet ? ["interlingua_packet"] : ["thought_text", "provisional_interlingua"],
      delivery_controls_used: sourceControls,
      provider_tags_used: command.provider_tags ? [command.provider_tags] : [],
      uncertainties: [
        "VoiceDesign prompt is a lossy provider projection from Weksa-owned delivery intent.",
      ],
    },
  };
}

function buildVoiceDesignPrompt({ command, personaEvidence, targetRealization }) {
  const combinedControls = [
    ...personaEvidence.delivery_hints,
    ...(Array.isArray(command.delivery_controls) ? command.delivery_controls : []),
  ].filter((value, index, array) => value && array.indexOf(value) === index);
  const controls = combinedControls.length
    ? combinedControls.join(", ")
    : "projected Persona voice, clear character delivery, preserve source intent";
  const forbidden = Array.isArray(command.forbidden_traits) && command.forbidden_traits.length
    ? ` Avoid ${command.forbidden_traits.join(", ")}.`
    : " Avoid generic assistant voice and do not rewrite the spoken text.";
  return `${personaEvidence.basename} voice for ${targetRealization.performance_register.label}: ${controls}.${forbidden}`;
}

async function callMimoVoiceDesign(mimoRequest) {
  if (!existsSync(mimoApiKeyPath)) {
    throw httpError(500, `MiMo API key file is missing: ${mimoApiKeyPath}`);
  }
  const apiKey = readFileSync(mimoApiKeyPath, "utf8").trim();
  const providerBody = {
    model: "mimo-v2.5-tts-voicedesign",
    messages: [
      { role: "user", content: mimoRequest.messages.user_voice_design_instruction },
      { role: "assistant", content: mimoRequest.messages.assistant_spoken_content },
    ],
    audio: {
      format: "wav",
      optimize_text_preview: false,
    },
  };
  const providerResponse = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(providerBody),
  });
  const text = await providerResponse.text();
  if (!providerResponse.ok) {
    throw httpError(502, `MiMo VoiceDesign failed with HTTP ${providerResponse.status}: ${redactProviderError(text)}`);
  }
  const json = JSON.parse(text);
  const audioData = json.choices?.[0]?.message?.audio?.data;
  if (!audioData) {
    throw httpError(502, "MiMo VoiceDesign response did not include audio data");
  }
  return {
    id: json.id ?? null,
    created: json.created ?? null,
    audioBytes: Buffer.from(audioData, "base64"),
  };
}

function fact(label, value) {
  return {
    id: `weksa.operator.fact.${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    kind: "text",
    props: { label, text: `${label}: ${value}` },
  };
}

function publication(key, schema, witness, endpoint) {
  return {
    key,
    schema,
    witness,
    compatibility_endpoint: endpoint,
    authority: "Weksa daemon",
  };
}

async function writeWitness(name, value) {
  const path = resolve(stateRoot, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${toCultCacheText(value)}\n`, "utf8");
}

function toCultCacheText(value) {
  return renderYaml(value).trim();
}

function renderYaml(value, indent = 0) {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return value.map((item) => {
      if (item && typeof item === "object") {
        return `${pad}-\n${renderYaml(item, indent + 2)}`;
      }
      return `${pad}- ${yamlScalar(item)}`;
    }).join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => {
        if (entryValue && typeof entryValue === "object") {
          return `${pad}${key}:\n${renderYaml(entryValue, indent + 2)}`;
        }
        return `${pad}${key}: ${yamlScalar(entryValue)}`;
      })
      .join("\n");
  }
  return `${pad}${yamlScalar(value)}`;
}

function yamlScalar(value) {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = String(value);
  if (!text || /[:#\n\r\t{}[\],&*?|-]|^\s|\s$/.test(text)) {
    return JSON.stringify(text);
  }
  return text;
}

async function collectFiles(root, extension) {
  if (!existsSync(root)) {
    return [];
  }
  const entries = await readdir(root, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const child = resolve(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectFiles(child, extension));
    } else if (entry.name.endsWith(extension)) {
      results.push(child);
    }
  }
  return results;
}

function readdirSyncSafe(path) {
  try {
    return existsSync(path) ? readdirSync(path) : [];
  } catch {
    return [];
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

async function readJsonBody(request) {
  const chunks = [];
  let byteLength = 0;
  for await (const chunk of request) {
    byteLength += chunk.length;
    if (byteLength > 1_000_000) {
      throw httpError(413, "request body is too large");
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    throw httpError(400, "request body is empty");
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw httpError(400, `invalid JSON body: ${error.message}`);
  }
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function redactProviderError(text) {
  return String(text).replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]");
}

async function appendLog(line) {
  await mkdir(dirname(logPath), { recursive: true });
  const previous = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  await writeFile(logPath, `${previous}[${new Date().toISOString()}] ${line}\n`, "utf8");
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--host":
        parsed.host = args[index + 1];
        index += 1;
        break;
      case "--port":
        parsed.port = args[index + 1];
        index += 1;
        break;
      case "--state-root":
        parsed.stateRoot = args[index + 1];
        index += 1;
        break;
      case "--mimo-api-key-path":
        parsed.mimoApiKeyPath = args[index + 1];
        index += 1;
        break;
      case "--idunn-rudp-health":
        parsed.idunnRudpHealth = args[index + 1];
        index += 1;
        break;
      case "--idunn-daemon":
        parsed.idunnDaemon = args[index + 1];
        index += 1;
        break;
      case "--idunn-health-contract":
        parsed.idunnHealthContract = args[index + 1];
        index += 1;
        break;
      case "--health":
        parsed.health = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}
