# Utterance Embedding Handoff

Version: `0.1`

The utterance embedding is the compact learned handoff from Weksa-authored line
intent to AquaSynth voice control.

```text
interlingua packet
  -> projected Ghostlight/Epiphany-shaped character context
  -> flavored English line
  -> speech text embedding
  -> PanPhon feature sequence
  -> AquaSynth phonetic sequence encoder
  -> phonetic realization embedding
  -> prosody and emphasis hints
  -> character state vector
  -> AquaSynth utterance embedding encoder
  -> utterance embedding
  -> AquaSynth synth driver
```

Weksa does not own the optimizer. Weksa owns the inspected ingredients that make
training possible:

- source interlingua and lowering trace;
- spoken and normalized text;
- speech text embedding reference when the utterance has meaningful text;
- PanPhon feature sequence for IPA/phones, pronunciation, and alien speech
  surfaces;
- prosody and emphasis hints;
- projected character-state vector;
- audit projection for semantic preservation and delivery pressure;
- training references and human review notes.

AquaSynth owns:

- the tiny learned utterance-embedding encoder;
- the shared packed-buffer gradient-descent/Adam primitive;
- the synth-driver model that consumes the utterance embedding;
- phonetic feature interpretation, timing, articulation, tract, and DSP;
- audio evaluation.

The point is one learned speech handoff, not two little neural courthouses
arguing about who gets to wear the robe.

## Packet Contract

This is the first fixed training contract. Weksa may evolve later versions, but
`weksa.utterance_embedding_handoff.v0.1` must remain stable enough for
AquaSynth to train against it without discovering that the input floor moved
under its feet.

Vector sizes:

- `speech_text_embedding`: 1024 floats, `bge-m3:latest`, normalized to `[-1, 1]`
  when inlined or stored. This is semantic/textual evidence, not a pronunciation
  or alien-phonetics embedding.
- `panphon_sequence`: variable-length IPA/phone sequence with PanPhon feature
  vectors plus stress, length, tone, boundary, and timing markers. This is the
  speech-surface evidence channel for English pronunciations, IPA strings, and
  alien phonetic material.
- `phonetic_realization_embedding`: 256 floats, AquaSynth-owned learned output
  from the PanPhon sequence encoder.
- `prosody_emphasis_hints`: 32 floats, deterministic Weksa projection.
- `character_state_vector`: 64 floats, deterministic Ghostlight/Epiphany-shaped
  speaker-state projection.
- `utterance_embedding`: 64 floats, AquaSynth-owned learned output.

Weksa owns the semantic text vector, PanPhon sequence evidence, prosody vector,
character-state vector, and audit projection. AquaSynth owns the 256-float
phonetic realization embedding, the 64-float learned utterance embedding, and
all training that maps those surfaces into speech automation. If a vector field
is not known yet or does not apply, Weksa emits zeroes and records the
uncertainty; it does not resize the vector. Vector resizing is a schema-version
change.

Do not feed IPA, romanized alien speech, or phoneme strings into
`speech_text_embedding` and pretend the result means anything. English text
semantics and phonetic realization are separate witnesses. For pure IPA or alien
phonetic fixtures, the text embedding may be zero or point to the source
meaning packet while `panphon_sequence` carries the sound-shape evidence.

The first emitted training artifact is
`examples/speech-training/tiny-panphon-v0.1/batch.json`. It contains six pure
IPA seed packets (`a`, `pa`, `ta`, `ka`, `sa`, and `ma`) with zeroed semantic
text embeddings, inline PanPhon-style feature frames, deterministic
prosody/emphasis hints, and the Epiphany-compatible neutral 64-slot character
state vector. The AquaSynth-owned learned fields are present but marked
pending, so training can begin from a real Weksa artifact without pretending
Weksa owns the optimizer.

```yaml
schema_version: weksa.utterance_embedding_handoff.v0.1
source_output_ref:
speaker_agent_id:
text:
  spoken_text:
  normalized_text:
inputs:
  speech_text_embedding:
    model_id: bge-m3:latest
    dimensionality: 1024
    values_ref:
  panphon_sequence:
    model_id: panphon
    source:
    ipa:
    frames_ref:
  prosody_emphasis_hints:
    dimensionality: 32
    values:
  character_state_vector:
    source:
    dimensionality: 64
    values_ref:
phonetic_realization_embedding:
  owner: AquaSynth
  model_id: aquasynth.panphon_sequence_encoder.v0.1
  dimensionality: 256
  values_ref:
utterance_embedding:
  owner: AquaSynth
  model_id:
  version:
  training_set:
  dimensionality: 64
  values_ref:
audit_projection:
  semantic_preservation:
  emphasis:
  prosody:
  character_pressure:
  delivery_shape:
training_refs:
  positive_examples:
  negative_examples:
trace:
  notes:
  uncertainties:
```

Early fixtures may use toy schema versions for smoke tests, but training
fixtures for AquaSynth must use the fixed v0.1 sizes. Large vectors should use
`values_ref`; tiny examples may show truncated previews only if they are marked
as non-training fixtures.

## Prosody And Character Axes

The v0.1 vector names are review labels, not the true learned latent space.
They stabilize Weksa output and help humans inspect what the training packet is
trying to preserve.

`panphon_sequence` is deterministic speech-surface evidence. Its first v0.1
implementation should use PanPhon-style ternary articulatory features as the
per-phone spine, then add stress, length, tone, boundary, and timing markers.
It is not a semantic embedding. AquaSynth trains
`aquasynth.panphon_sequence_encoder.v0.1` to compress that variable-length
sequence into the 256-float `phonetic_realization_embedding`.

`prosody_emphasis_hints` uses 32 slots:

1. mean pitch pressure
2. pitch rise
3. pitch fall
4. pitch range
5. loudness pressure
6. loudness attack
7. loudness release
8. speaking rate
9. articulation precision
10. pause pressure
11. phrase-final lengthening
12. stress contrast
13. clippedness
14. breathiness
15. creak pressure
16. smoothness
17. warmth
18. threat
19. urgency
20. hesitation
21. irony/dryness
22. tenderness
23. contempt
24. command force
25. question contour
26. exclamation pressure
27. secrecy/low projection
28. ritual/formality pressure
29. playful pressure
30. fatigue
31. emotional containment
32. reserved

`character_state_vector` uses 64 slots. The first 32 are current-state pressure,
the second 32 are slower speaker traits or situational context. Unknown slots
are zero and explained in `trace.uncertainties`.

## Audit Projection

The audit projection is not the embedding. It is a human-readable probe of what
the embedding should preserve.

Useful audit families:

- `semantic_preservation`: what source meaning must remain audible.
- `emphasis`: which words or spans carry prominence.
- `prosody`: clipped, rising, flat, hesitant, compressed, etc.
- `character_pressure`: active state pressures shaping delivery.
- `delivery_shape`: pace, pause pattern, intensity, warmth, contempt, tenderness,
  threat, or play.

These labels guide review and training. The learned embedding may find better
internal dimensions, but it does not get to skip accountability.

## Training Loop

First loop:

1. Author or generate an interlingua packet.
2. Project Ghostlight/Epiphany-shaped character context.
3. Lower to English.
4. Generate or attach a speech text embedding when the line has text semantics.
5. Emit PanPhon sequence evidence from pronunciation/IPA material.
6. Emit prosody/emphasis hints and a projected character state vector.
7. AquaSynth trains or applies the phonetic sequence encoder to produce the
   256-float phonetic realization embedding.
8. Human-review whether the line preserves meaning, pronunciation, and voice.
9. AquaSynth trains the utterance embedding encoder.
10. AquaSynth feeds the utterance embedding to the synth driver.
11. Compare rendered speech against human notes and reference takes when
    present.

The same fixture can carry accepted lines, rejected lines, audit projections,
input vectors, downstream AquaSynth evaluation pointers, and notes about why a
candidate failed.

## Non-Goals

- Do not make Weksa emit raw vocal-tract controls.
- Do not make Weksa train its own speech embedding optimizer.
- Do not make AquaSynth infer character psychology from prose alone.
- Do not treat named audit axes as the true latent space.
- Do not make realtime neural voice output the authority.
- Do not hide bad semantic preservation behind pleasant delivery.
