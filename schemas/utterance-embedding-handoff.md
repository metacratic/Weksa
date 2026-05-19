# Utterance Embedding Handoff Contract

This is the human-facing schema receipt for Weksa-to-AquaSynth utterance
embedding handoff packets.

The packet sits after flavored-English lowering and before AquaSynth speech
control. It carries the inspected inputs for a learned utterance embedding:
speech text embedding, prosody/emphasis hints, and a projected character-state
vector from the speaker's Ghostlight/Epiphany-shaped profile.

## Required Fields

- `schema_version`: currently `weksa.utterance_embedding_handoff.v0`.
- `source_output_ref`: lowered English output reference.
- `speaker_agent_id`: speaker identity.
- `text`: spoken and normalized text.
- `inputs.speech_text_embedding`: model metadata, dimensionality, and values or
  `values_ref`.
- `inputs.prosody_emphasis_hints`: compact deterministic hints for emphasis,
  contour, pace, intensity, and pause pressure.
- `inputs.character_state_vector`: projected speaker-state vector and source.
- `utterance_embedding`: AquaSynth-owned model metadata and produced vector
  reference when available.
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
