"use strict";

const dgram = require("dgram");
const path = require("path");

const {
  CultNetRudpSession,
  decodeRudpPacket,
  encodeCultNetMessageForWire,
  encodeRudpPacket,
  parseCultNetMessage,
} = require("cultnet-ts");

const { encode, decode } = require(path.resolve(
  __dirname,
  "..",
  "..",
  "CultLib",
  "node_modules",
  "@msgpack",
  "msgpack",
));

const CULTNET_RUDP_PROTOCOL_ID = "cultnet.transport.rudp.v0";
const WEKSA_COMMAND_RUDP_CONNECTION_ID = 0x1d0d0002;
const WEKSA_MIMO_VOICEDESIGN_COMMAND_SCHEMA_ID = "weksa.mimo_voicedesign_command.v0";
const WEKSA_MIMO_VOICEDESIGN_RECEIPT_SCHEMA_ID = "weksa.mimo_voicedesign_receipt.v0";

async function createWeksaRudpCommandServer(options) {
  if (!options?.host || !options?.port || typeof options.onCommand !== "function") {
    throw new Error("Weksa RUDP command server requires host, port, and onCommand.");
  }
  const socket = dgram.createSocket(endpointFamily(options.host));
  await bindServerSocket(socket, options.host, options.port);

  const sessions = new Map();
  const resendTimer = setInterval(() => {
    for (const entry of sessions.values()) {
      for (const packet of entry.session.dueResends(Date.now())) {
        void sendPacket(socket, entry.endpoint, packet);
      }
    }
  }, 25);
  resendTimer.unref?.();

  const onMessage = (wire, remote) => {
    void handleServerDatagram({
      wire,
      remote,
      socket,
      sessions,
      options,
    }).catch((error) => {
      options.onError?.(error);
    });
  };
  const onError = (error) => {
    options.onError?.(error instanceof Error ? error : new Error(String(error)));
  };

  socket.on("message", onMessage);
  socket.on("error", onError);

  return {
    endpoint: { host: options.host, port: options.port },
    uri: formatRudpEndpoint(options.host, options.port),
    close() {
      clearInterval(resendTimer);
      socket.off("message", onMessage);
      socket.off("error", onError);
      socket.close();
      sessions.clear();
    },
  };
}

async function handleServerDatagram(input) {
  const { wire, remote, socket, sessions, options } = input;
  const packet = decodeRudpPacket(wire);
  const key = endpointKey(remote.address, remote.port);
  let entry = sessions.get(key);
  if (!entry) {
    if (packet.packetType !== "connect") {
      return;
    }
    const session = new CultNetRudpSession({
      connectionId: WEKSA_COMMAND_RUDP_CONNECTION_ID,
      initialSequence: 1,
      resendDelayMs: 100,
      maxPendingReliablePackets: 64,
    });
    entry = {
      session,
      endpoint: { host: remote.address, port: remote.port },
    };
    sessions.set(key, entry);
    await sendPacket(socket, entry.endpoint, session.acceptConnect(packet, Date.now()));
    return;
  }

  const result = entry.session.receive(packet, Date.now());
  if (result.reply) {
    await sendPacket(socket, entry.endpoint, result.reply);
  }
  for (const frame of result.delivered) {
    await handleServerFrame({
      socket,
      entry,
      frame,
      options,
    });
  }
  if (packet.packetType === "accept" || result.delivered.length > 0) {
    await sendPacket(socket, entry.endpoint, entry.session.createAck());
  }
  if (result.disconnected) {
    sessions.delete(key);
  }
}

async function handleServerFrame(input) {
  const { socket, entry, frame, options } = input;
  if (frame.channelId !== "schema") {
    return;
  }
  const message = parseCultNetMessage(decode(frame.payload), "cultnet.schema.v0");
  if (message.schemaVersion !== "cultnet.document_put_raw.v0") {
    return;
  }
  if (message.document.schemaId !== WEKSA_MIMO_VOICEDESIGN_COMMAND_SCHEMA_ID) {
    return;
  }
  const payload = decode(message.document.payload);
  const command = {
    ...payload,
    request_id: payload?.request_id ?? message.document.recordKey,
  };
  let receipt;
  try {
    receipt = await options.onCommand(command, message);
  } catch (error) {
    options.onError?.(error instanceof Error ? error : new Error(String(error)));
    receipt = {
      schema_version: WEKSA_MIMO_VOICEDESIGN_RECEIPT_SCHEMA_ID,
      request_id: command.request_id,
      generated_at: new Date().toISOString(),
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  if (!receipt) {
    return;
  }
  const receiptMessage = {
    schemaVersion: "cultnet.document_put_raw.v0",
    messageId: `${options.runtimeId ?? "weksa-daemon"}:receipt:${receipt.request_id}`,
    document: {
      schemaId: WEKSA_MIMO_VOICEDESIGN_RECEIPT_SCHEMA_ID,
      recordKey: receipt.request_id,
      storedAt: receipt.generated_at ?? receipt.observed_at ?? new Date().toISOString(),
      payloadEncoding: "messagepack",
      payload: encode(receipt),
      sourceRuntimeId: options.runtimeId ?? "weksa-daemon",
      sourceRole: "weksa-command-ingress",
      tags: [CULTNET_RUDP_PROTOCOL_ID, "speech_provider.mimo.voicedesign"],
    },
  };
  const wirePayload = encode(
    encodeCultNetMessageForWire(receiptMessage, "cultnet.schema.v0"),
  );
  for (const packet of entry.session.sendMany("schema", wirePayload, {
    reliable: true,
    ordered: true,
    nowMs: Date.now(),
  })) {
    await sendPacket(socket, entry.endpoint, packet);
  }
}

async function sendWeksaMimoVoiceDesignCommand(options) {
  const endpoint = parseEndpoint(options?.endpoint);
  const requestId = options.command?.request_id ?? buildRequestId();
  const command = {
    ...options.command,
    request_id: requestId,
  };
  const socket = dgram.createSocket(endpointFamily(endpoint.host));
  await bindClientSocket(socket, options?.localHost);
  const receiver = createPacketReceiver(socket);
  const session = new CultNetRudpSession({
    connectionId: WEKSA_COMMAND_RUDP_CONNECTION_ID,
    initialSequence: 1,
    resendDelayMs: 100,
    maxPendingReliablePackets: 64,
  });

  try {
    await sendPacket(socket, endpoint, session.createConnect(Date.now(), new Uint8Array()));
    await receiveCultNetMessageUntil({
      receiver,
      session,
      endpoint,
      timeoutMs: options.timeoutMs ?? 5000,
      label: "accept",
      predicate: (_message, packet) => packet.packetType === "accept",
    });

    const commandMessage = {
      schemaVersion: "cultnet.document_put_raw.v0",
      messageId: `${options.runtimeId ?? "weksa-cli"}:command:${requestId}`,
      document: {
        schemaId: WEKSA_MIMO_VOICEDESIGN_COMMAND_SCHEMA_ID,
        recordKey: requestId,
        storedAt: new Date().toISOString(),
        payloadEncoding: "messagepack",
        payload: encode(command),
        sourceRuntimeId: options.runtimeId ?? "weksa-cli",
        sourceRole: "command-client",
        tags: [CULTNET_RUDP_PROTOCOL_ID, "speech_provider.mimo.voicedesign"],
      },
    };
    const wirePayload = encode(
      encodeCultNetMessageForWire(commandMessage, "cultnet.schema.v0"),
    );
    for (const packet of session.sendMany("schema", wirePayload, {
      reliable: true,
      ordered: true,
      nowMs: Date.now(),
    })) {
      await sendPacket(socket, endpoint, packet);
    }

    return await receiveCultNetMessageUntil({
      receiver,
      session,
      endpoint,
      timeoutMs: options.timeoutMs ?? 10000,
      label: "receipt",
      predicate: (message) =>
        message.schemaVersion === "cultnet.document_put_raw.v0"
        && message.document.schemaId === WEKSA_MIMO_VOICEDESIGN_RECEIPT_SCHEMA_ID
        && message.document.recordKey === requestId,
      decodePayload: true,
    });
  } finally {
    receiver.close();
    socket.close();
  }
}

async function receiveCultNetMessageUntil(options) {
  const deadline = Date.now() + options.timeoutMs;
  while (Date.now() < deadline) {
    try {
      const packet = await options.receiver.next(
        Math.min(100, Math.max(1, deadline - Date.now())),
        options.label,
      );
      const result = options.session.receive(packet, Date.now());
      if (result.reply) {
        await sendPacket(options.receiver.socket, options.endpoint, result.reply);
      }
      if (packet.packetType === "accept" || result.delivered.length > 0) {
        await sendPacket(
          options.receiver.socket,
          options.endpoint,
          options.session.createAck(),
        );
      }
      if (packet.packetType === "accept" && options.predicate(undefined, packet)) {
        return undefined;
      }
      for (const frame of result.delivered) {
        if (frame.channelId !== "schema") {
          continue;
        }
        const message = parseCultNetMessage(decode(frame.payload), "cultnet.schema.v0");
        if (!options.predicate(message, packet)) {
          continue;
        }
        if (
          options.decodePayload
          && message.schemaVersion === "cultnet.document_put_raw.v0"
        ) {
          return decode(message.document.payload);
        }
        return message;
      }
    } catch (error) {
      if (error.code !== "ETIMEDOUT") {
        throw error;
      }
    }
    for (const packet of options.session.dueResends(Date.now())) {
      await sendPacket(options.receiver.socket, options.endpoint, packet);
    }
  }
  throw new Error(`timed out waiting for Weksa RUDP ${options.label} after ${options.timeoutMs}ms`);
}

async function bindServerSocket(socket, host, port) {
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.bind(port, host, () => {
      socket.off("error", reject);
      resolve();
    });
  });
}

async function bindClientSocket(socket, localHost) {
  const bindHost = localHost ?? "0.0.0.0";
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.bind(0, bindHost, () => {
      socket.off("error", reject);
      resolve();
    });
  });
}

function createPacketReceiver(socket) {
  const packets = [];
  const waiters = [];
  const errors = [];

  const resolveNext = () => {
    while (waiters.length > 0 && (packets.length > 0 || errors.length > 0)) {
      const waiter = waiters.shift();
      clearTimeout(waiter.timer);
      if (errors.length > 0) {
        waiter.reject(errors.shift());
      } else {
        waiter.resolve(packets.shift());
      }
    }
  };

  const onMessage = (wire) => {
    try {
      packets.push(decodeRudpPacket(wire));
    } catch (error) {
      errors.push(error);
    }
    resolveNext();
  };
  const onError = (error) => {
    errors.push(error);
    resolveNext();
  };

  socket.on("message", onMessage);
  socket.on("error", onError);

  return {
    socket,
    next(timeoutMs, label = "packet") {
      if (packets.length > 0) {
        return Promise.resolve(packets.shift());
      }
      if (errors.length > 0) {
        return Promise.reject(errors.shift());
      }
      return new Promise((resolve, reject) => {
        const waiter = {
          resolve,
          reject,
          timer: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index >= 0) {
              waiters.splice(index, 1);
            }
            const error = new Error(`timed out waiting for Weksa RUDP ${label}`);
            error.code = "ETIMEDOUT";
            reject(error);
          }, Math.max(1, timeoutMs)),
        };
        waiters.push(waiter);
      });
    },
    close() {
      socket.off("message", onMessage);
      socket.off("error", onError);
      while (waiters.length > 0) {
        const waiter = waiters.shift();
        clearTimeout(waiter.timer);
        const error = new Error("Weksa RUDP command receiver closed.");
        error.code = "ECLOSED";
        waiter.reject(error);
      }
    },
  };
}

async function sendPacket(socket, endpoint, packet) {
  const wire = encodeRudpPacket(packet);
  await new Promise((resolve, reject) => {
    socket.send(wire, endpoint.port, endpoint.host, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function parseEndpoint(value) {
  if (!value) {
    throw new Error("Weksa RUDP endpoint is required.");
  }
  const text = String(value).trim();
  if (text.toLowerCase().startsWith("rudp://")) {
    const parsed = new URL(text);
    return {
      host: parsed.hostname,
      port: parsePort(parsed.port),
    };
  }
  const ipv6 = text.match(/^\[([^\]]+)\]:(\d+)$/);
  if (ipv6) {
    return { host: ipv6[1], port: parsePort(ipv6[2]) };
  }
  const index = text.lastIndexOf(":");
  if (index <= 0) {
    throw new Error(`Weksa RUDP endpoint must be host:port, got "${value}".`);
  }
  return {
    host: text.slice(0, index),
    port: parsePort(text.slice(index + 1)),
  };
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Weksa RUDP endpoint port is invalid: ${value}`);
  }
  return port;
}

function endpointFamily(host) {
  return host.includes(":") ? "udp6" : "udp4";
}

function endpointKey(host, port) {
  return `${host}:${port}`;
}

function formatRudpEndpoint(host, port) {
  return host.includes(":") ? `rudp://[${host}]:${port}` : `rudp://${host}:${port}`;
}

function buildRequestId() {
  return `mimo-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  CULTNET_RUDP_PROTOCOL_ID,
  WEKSA_COMMAND_RUDP_CONNECTION_ID,
  WEKSA_MIMO_VOICEDESIGN_COMMAND_SCHEMA_ID,
  WEKSA_MIMO_VOICEDESIGN_RECEIPT_SCHEMA_ID,
  createWeksaRudpCommandServer,
  sendWeksaMimoVoiceDesignCommand,
  formatRudpEndpoint,
};
