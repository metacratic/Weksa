# Weksa Verse Service Contract

Weksa is the language-intent daemon. It turns writing, dialogue pressure, and
agent state into typed conversational intent, then lowers that intent into
utterance documents for speech, text, and synthesis consumers.

## Authority

Owner: Weksa.

Inputs:

- writing or dialogue drafts
- `weksa.interlingua_packet.v0` meaning packets
- `gamecult.persona_state.v0` or compatible agent-state projections
- language-project state, pronunciation rules, and flavor profiles
- optional speaker, scene, and discourse constraints

Outputs:

- `weksa.conversational_intent.v0`
- `weksa.pronunciation_plan.v0`
- `weksa.utterance_handoff.v0`
- `weksa.utterance_embedding_handoff.v0.1`
- `weksa.mimo_tts_request.v0`
- `weksa.mimo_voicedesign_receipt.v0`
- Eve/CultUI surfaces for intent review, pronunciation inspection, and handoff
  traces

Weksa owns conversational intent and utterance lowering. AquaSynth owns learned
phonetic realization, packed utterance embeddings, synth-driver controls, Faust
compilation, live instrument handles, and rendered audio. MiMo owns provider
voice rendering and audio bytes; Weksa owns the VoiceDesign request projection
and trace.

## CultCache Witnesses

- `.weksa/provider-advertisement.cc`: read-only provider advertisement witness.
- `.weksa/provider-advertisement-store.cc`: CultMesh/CultCache provider store
  containing `gamecult.eve.provider_advertisement.v1`,
  `gamecult.eve.interface_binding.v1`, and `gamecult.eve.surface_state.v1`
  records for Odin discovery.
- `.weksa/operator-state.cc`: daemon health, readiness, and runtime witness
  index used by Idunn health checks and operator inspection.
- `.weksa/eve-surfaces.cc`: current Weksa operator Eve surface witness.
- `.weksa/cultmesh-publications.cc`: publication index naming current Weksa
  witness surfaces and compatibility routes.
- `.weksa/intent/{intentId}.cc`: conversational intent documents.
- `.weksa/pronunciation/{utteranceId}.cc`: pronunciation plans and phonetic
  event sequences.
- `.weksa/handoff/{utteranceId}.cc`: utterance handoffs and embedding handoff
  requests for AquaSynth.
- `.weksa/speech-provider/mimo/{requestId}/interlingua.cc`: accepted or
  provisionally decomposed interlingua used for a MiMo verbalization command.
- `.weksa/speech-provider/mimo/{requestId}/mimo-request.cc`: Weksa-owned MiMo
  VoiceDesign request projection.
- `.weksa/speech-provider/mimo/{requestId}/receipt.cc`: provider response
  receipt and artifact references.
- `.weksa/traces/{traceId}.cc`: lowering traces naming the stage that made each
  decision.
- `.weksa/projects/{projectId}.cc`: language-project and flavor-profile state.
- `.weksa/cultural-ontology/{storeId}.cc`: reviewed or draft guarded cultural
  ontology profile stores used by utterance lowering.

Early exporters may publish fixtures before a daemon loop exists, but the
witness names are not decorative. These are the state surfaces the daemon must
commit when the runtime lands.

The local Starfire daemon is launched by `scripts/start-weksa-daemon.ps1`,
checked by `scripts/health-weksa-daemon.cmd`, and restarted by
`scripts/restart-weksa-daemon.cmd`. Its compatibility HTTP surface listens on
`http://127.0.0.1:8813` with `/health`, `/provider-advertisement`,
`/operator-state`, `/eve/operator`, `/cultmesh/publications`, and
`POST /speech-provider/mimo/voicedesign`.

## CultMesh Verses

- `weksa.service`: service identity, schema catalog, version, and health.
- `weksa.intent`: conversational intent documents and review queues.
- `weksa.language_project`: language-project state, flavor profiles, and
  pronunciation rules.
- `weksa.cultural_ontology`: cultural ontology catalogs, profile stacks,
  salience axes, linguistic affordances, activation gates, and evidence refs.
- `weksa.pronunciation`: phonetic plans, IPA spans, prosody, and trace
  evidence.
- `weksa.utterance`: utterance handoff documents, packed embedding requests,
  and AquaSynth binding receipts.
- `weksa.speech_provider`: provider-specific request projections and receipts
  for external speech systems such as MiMo VoiceDesign.
- `weksa.operator`: daemon status, queue pressure, schema drift, and witness
  freshness.

Odin ingests the Starfire Weksa provider through
`.weksa/provider-advertisement-store.cc`. Idunn tracks the daemon as target
`weksa` in the `starfire-local` swarm profile and owns restart authority through
the Weksa restart script.

## Eve Surfaces

- `weksa.eve.intent_review.v0`: inspect typed conversational intent before it
  becomes an utterance.
- `weksa.eve.pronunciation_trace.v0`: inspect pronunciation and IPA/prosody
  lowering.
- `weksa.eve.utterance_handoff.v0`: inspect handoff packets, embedding request
  status, and AquaSynth receipt links.
- `weksa.eve.operator.v0`: compact daemon state, queues, schema versions, and
  witness freshness.

## Commands

- `intent.create`: convert writing or interlingua into typed conversational
  intent.
- `intent.review`: accept, reject, or revise intent through the same commit
  path used by automated jobs.
- `utterance.lower`: lower accepted intent and agent state into pronunciation
  and utterance handoff documents.
- `handoff.export`: emit typed `.cc` witnesses for AquaSynth consumption.
- `speech_provider.mimo.voicedesign`: accept a Persona/agent state file plus
  either a Weksa interlingua packet or raw thought text. Raw thought is first
  decomposed into provisional interlingua, then lowered into a MiMo VoiceDesign
  request and rendered through MiMo.
- `provider.advertise`: publish `gamecult.eve.provider_advertisement.v1`.

## Forbidden Writers

- Text renderers do not own meaning.
- AquaSynth does not own conversational intent.
- Eve lowerings do not own Weksa state.
- Fixture emitters cannot become an alternate runtime truth.
- Agent transcript memory cannot silently override typed Persona or intent
  documents.
- MiMo cannot rewrite accepted spoken text or become a second Persona-state
  interpreter.
