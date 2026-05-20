# Utterance Embedding Handoff Contract

This is the human-facing schema receipt for Weksa-to-AquaSynth utterance
embedding handoff packets.

The packet sits after flavored-English lowering and before AquaSynth speech
control. It carries the inspected inputs for a learned utterance embedding:
speech text embedding, PanPhon sequence evidence, prosody/emphasis hints, a
projected character-state vector from the speaker's Ghostlight/Epiphany-shaped
profile, and AquaSynth's phonetic realization embedding when available.

## Required Fields

- `schema_version`: currently `weksa.utterance_embedding_handoff.v0.1`.
- `source_output_ref`: lowered English output reference.
- `speaker_agent_id`: speaker identity.
- `text`: spoken and normalized text.
- `inputs.speech_text_embedding`: model metadata, dimensionality, and values or
  `values_ref`; v0.1 uses `bge-m3:latest` with 1024 floats. This channel is for
  text semantics, not IPA or alien phonetic strings.
- `inputs.panphon_sequence`: pronunciation/IPA/phone metadata plus PanPhon
  feature frames and stress, length, tone, boundary, and timing markers.
- `inputs.prosody_emphasis_hints`: compact deterministic hints for emphasis,
  contour, pace, intensity, and pause pressure; v0.1 uses 32 floats.
- `inputs.character_state_vector`: projected speaker-state vector and source;
  v0.1 uses 64 floats.
- `phonetic_realization_embedding`: AquaSynth-owned 256-float embedding produced
  by `aquasynth.panphon_sequence_encoder.v0.1` when available.
- `utterance_embedding`: AquaSynth-owned model metadata and produced vector
  reference when available; v0.1 uses 64 floats.
- `audit_projection`: human-readable probe of what the embedding should
  preserve.
- `trace`: notes and uncertainties.

## Boundary

Weksa owns the packet ingredients and audit surface. AquaSynth owns the learned
encoder, gradient descent, synth-driver model, and audio evaluation.

The utterance embedding is not canonical character state. It is a derived
runtime/training artifact.

The audit projection is not the true latent space. It is a review surface for
humans, tests, and training data.

## Stability Rule

Training packets must not change vector dimensionality inside a schema version.
If Weksa does not know a value yet, it emits `0` in the reserved slot and records
the uncertainty in `trace.uncertainties`. Adding, removing, or reordering vector
slots requires a new schema version and an AquaSynth migration note.

## Channel Split

The text embedding and PanPhon sequence must stay separate. A rich
English text embedding can carry meaning, register, and local phrasing, but it
does not become meaningful just because the input string is IPA. IPA and alien
phonetic material belong in `inputs.panphon_sequence`. Pure
phonetic fixtures may zero `inputs.speech_text_embedding` or point it to a
source meaning packet, but they must not smuggle phone strings through the
semantic-text channel.

The v0.1 phonetic channel uses PanPhon-style articulatory features as its
per-phone base representation. Weksa supplies that sequence evidence. AquaSynth
owns the learned compression from variable-length PanPhon sequence into the
256-float `phonetic_realization_embedding`.
