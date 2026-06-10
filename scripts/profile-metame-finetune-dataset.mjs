#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArgs(process.argv.slice(2));
const archivePath = resolve(options.archivePath ?? "E:/Projects/VoidBot/.voidbot/rag/messages.json");
const authorId = options.authorId ?? "113785782975594501";
const beforeMs = Date.parse(options.before ?? "2025-01-01T00:00:00Z");
const adjacencyMs = Number(options.adjacencyMinutes ?? 60) * 60_000;

const store = JSON.parse(readFileSync(archivePath, "utf8"));
const messages = (store.messages ?? [])
  .filter((message) => !message.deletedAt)
  .filter((message) => typeof message.content === "string" && message.content.trim().length > 0)
  .filter((message) => message.metadata?.messageKind !== "bot_prompt")
  .sort(compareByTimestamp);

const authorMessages = messages.filter((message) => message.authorId === authorId);
const preCutoff = authorMessages.filter((message) => timestampMs(message) < beforeMs);
const casualCandidates = preCutoff.filter(isCasualCandidate);
const adjacentRows = buildAdjacentRows(messages, authorId, beforeMs, adjacencyMs);

const stats = {
  schema_version: "weksa.finetune_dataset_profile.v0",
  archive_path: archivePath,
  author_id: authorId,
  cutoff_before: new Date(beforeMs).toISOString(),
  adjacency_minutes: adjacencyMs / 60_000,
  counts: {
    archive_messages: store.messages?.length ?? 0,
    usable_text_messages: messages.length,
    author_messages: authorMessages.length,
    author_pre_cutoff: preCutoff.length,
    author_pre_cutoff_casual_candidates: casualCandidates.length,
    adjacent_author_rows: adjacentRows.length,
    adjacent_reply_to_other: adjacentRows.filter((row) => row.previous_author_id !== authorId).length,
    adjacent_self_continuation: adjacentRows.filter((row) => row.previous_author_id === authorId).length,
  },
  author_length_chars: lengthPercentiles(authorMessages.map((message) => message.content.trim().length)),
  author_by_year: countBy(authorMessages, (message) => yearOf(message.timestamp)),
  adjacent_by_year: countBy(adjacentRows, (row) => yearOf(row.timestamp)),
  adjacent_length_classes: countBy(adjacentRows, (row) => row.length_class),
  top_adjacent_channels: topEntries(countBy(adjacentRows, (row) => row.channel_name || row.channel_id), 16),
  sample_ids: {
    short_reply_to_other: adjacentRows
      .filter((row) => row.length_class === "short" && row.previous_author_id !== authorId)
      .slice(0, 24)
      .map(toSampleId),
    medium_explanatory: adjacentRows
      .filter((row) => row.length_class === "medium")
      .slice(0, 24)
      .map(toSampleId),
    long_explanatory: adjacentRows
      .filter((row) => row.length_class === "long")
      .slice(0, 24)
      .map(toSampleId),
  },
};

const output = `${JSON.stringify(stats, null, 2)}\n`;
if (options.out) {
  writeFileSync(resolve(repoRoot, options.out), output, "utf8");
} else {
  process.stdout.write(output);
}

function buildAdjacentRows(allMessages, targetAuthorId, cutoffMs, maxGapMs) {
  const byChannel = new Map();
  for (const message of allMessages) {
    if (!byChannel.has(message.channelId)) {
      byChannel.set(message.channelId, []);
    }
    byChannel.get(message.channelId).push(message);
  }

  const rows = [];
  for (const [channelId, channelMessages] of byChannel) {
    for (let index = 0; index < channelMessages.length; index += 1) {
      const message = channelMessages[index];
      if (message.authorId !== targetAuthorId || timestampMs(message) >= cutoffMs) {
        continue;
      }
      const currentMs = timestampMs(message);
      const previous = channelMessages
        .slice(Math.max(0, index - 8), index)
        .filter((candidate) => currentMs - timestampMs(candidate) <= maxGapMs);
      if (previous.length === 0) {
        continue;
      }
      rows.push({
        id: message.id,
        timestamp: message.timestamp,
        channel_id: channelId,
        channel_name: message.metadata?.channelName ?? "",
        previous_author_id: previous.at(-1)?.authorId ?? "",
        previous_count: previous.length,
        length: message.content.trim().length,
        length_class: classifyLength(message.content.trim().length),
      });
    }
  }
  return rows.sort(compareByTimestamp);
}

function isCasualCandidate(message) {
  const content = message.content.trim();
  return content.length >= 3 &&
    content.length <= 220 &&
    !/^https?:\/\//i.test(content) &&
    !content.includes("\n```") &&
    !/^>\s{0,3}\w/.test(content);
}

function classifyLength(length) {
  if (length <= 80) {
    return "short";
  }
  if (length <= 220) {
    return "medium";
  }
  return "long";
}

function lengthPercentiles(lengths) {
  const sorted = [...lengths].sort((left, right) => left - right);
  const pick = (fraction) => sorted[Math.floor((sorted.length - 1) * fraction)] ?? 0;
  return {
    p10: pick(0.10),
    p25: pick(0.25),
    median: pick(0.50),
    p75: pick(0.75),
    p90: pick(0.90),
  };
}

function countBy(values, keyFn) {
  const counts = {};
  for (const value of values) {
    const key = keyFn(value) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function topEntries(counts, limit) {
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function toSampleId(row) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    channel: row.channel_name || row.channel_id,
    length: row.length,
  };
}

function yearOf(timestamp) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? String(date.getUTCFullYear()) : "unknown";
}

function timestampMs(message) {
  return Date.parse(typeof message === "string" ? message : message.timestamp);
}

function compareByTimestamp(left, right) {
  const delta = timestampMs(left) - timestampMs(right);
  return delta || String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--archive":
        parsed.archivePath = args[index + 1];
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
      case "--out":
        parsed.out = args[index + 1];
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}
