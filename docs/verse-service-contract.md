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
- Eve/CultUI surfaces for intent review, pronunciation inspection, and handoff
  traces

Weksa owns conversational intent and utterance lowering. AquaSynth owns learned
phonetic realization, packed utterance embeddings, synth-driver controls, Faust
compilation, live instrument handles, and rendered audio.

## CultCache Witnesses

- `.weksa/provider-advertisement.cc`: read-only provider advertisement witness.
- `.weksa/intent/{intentId}.cc`: conversational intent documents.
- `.weksa/pronunciation/{utteranceId}.cc`: pronunciation plans and phonetic
  event sequences.
- `.weksa/handoff/{utteranceId}.cc`: utterance handoffs and embedding handoff
  requests for AquaSynth.
- `.weksa/traces/{traceId}.cc`: lowering traces naming the stage that made each
  decision.
- `.weksa/projects/{projectId}.cc`: language-project and flavor-profile state.

Early exporters may publish fixtures before a daemon loop exists, but the
witness names are not decorative. These are the state surfaces the daemon must
commit when the runtime lands.

## CultMesh Verses

- `weksa.service`: service identity, schema catalog, version, and health.
- `weksa.intent`: conversational intent documents and review queues.
- `weksa.language_project`: language-project state, flavor profiles, and
  pronunciation rules.
- `weksa.pronunciation`: phonetic plans, IPA spans, prosody, and trace
  evidence.
- `weksa.utterance`: utterance handoff documents, packed embedding requests,
  and AquaSynth binding receipts.
- `weksa.operator`: daemon status, queue pressure, schema drift, and witness
  freshness.

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
- `provider.advertise`: publish `gamecult.eve.provider_advertisement.v1`.

## Forbidden Writers

- Text renderers do not own meaning.
- AquaSynth does not own conversational intent.
- Eve lowerings do not own Weksa state.
- Fixture emitters cannot become an alternate runtime truth.
- Agent transcript memory cannot silently override typed Persona or intent
  documents.
