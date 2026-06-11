#!/usr/bin/env node
import http from "node:http";
import Module from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArgs(process.argv.slice(2));
const port = Number(options.port ?? process.env.WEKSA_DAEMON_PORT ?? 8813);
const host = options.host ?? process.env.WEKSA_DAEMON_HOST ?? "127.0.0.1";
const stateRoot = resolve(repoRoot, options.stateRoot ?? process.env.WEKSA_STATE_ROOT ?? ".weksa");
const cultMeshStorePath = resolve(stateRoot, "provider-advertisement-store.cc");
const pidPath = resolve(stateRoot, "weksa-daemon.pid");
const logPath = resolve(stateRoot, "weksa-daemon.log");
const startedAt = new Date().toISOString();
let tick = 0;
let lastPublishedAt = "";
let lastError = undefined;
let cachedSnapshot = undefined;

if (options.health) {
  await runHealthCheck();
  process.exit(0);
}

await mkdir(stateRoot, { recursive: true });
await writeFile(pidPath, `${process.pid}\n`, "ascii");
await appendLog(`started pid=${process.pid} host=${host} port=${port}`);
await publishWitnesses();

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
    sendJson(response, 404, { ok: false, error: "unknown endpoint" });
  } catch (error) {
    lastError = String(error?.stack ?? error);
    await appendLog(`request error: ${lastError}`);
    sendJson(response, 500, { ok: false, error: String(error?.message ?? error) });
  }
});

server.listen(port, host, () => {
  appendLog(`listening http://${host}:${port}`).catch(() => {});
});

const interval = setInterval(() => {
  publishWitnesses().catch(async (error) => {
    lastError = String(error?.stack ?? error);
    await appendLog(`publish error: ${lastError}`);
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
}

async function currentSnapshot() {
  if (!cachedSnapshot) {
    await publishWitnesses();
  }
  return cachedSnapshot;
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
      accepts_commands: false,
      command_ingress: "not_enabled_until_command_commit_path_exists",
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
      native_cultnet_peer: "pending",
      compatibility_http: `http://${host}:${port}`,
    },
    publications: [
      publication("weksa.service/provider-advertisement", "gamecult.eve.provider_advertisement.v1", ".weksa/provider-advertisement-store.cc", "/provider-advertisement"),
      publication("weksa.operator/status", "weksa.operator_state.v0", ".weksa/operator-state.cc", "/operator-state"),
      publication("weksa.eve.surface.operator", "gamecult.eve.surface.v1", ".weksa/eve-surfaces.cc", "/eve/operator"),
      publication("weksa.cultmesh/publications", "weksa.cultmesh_publications.v0", ".weksa/cultmesh-publications.cc", "/cultmesh/publications"),
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
    process.env.NODE_PATH = [
      resolve(repoRoot, "..", "CultLib", "packages"),
      process.env.NODE_PATH || "",
    ].filter(Boolean).join(delimiter);
    Module._initPaths();
    const require = Module.createRequire(import.meta.url);
    const { CultMesh } = require("cultmesh-ts");
    const { defineDocumentType } = require("cultcache-ts");
    return { CultMesh, defineDocumentType, error: null };
  } catch (error) {
    return { CultMesh: null, defineDocumentType: null, error };
  }
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
      ],
    },
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
      case "--health":
        parsed.health = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}
