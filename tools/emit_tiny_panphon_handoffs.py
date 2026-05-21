#!/usr/bin/env python3
"""Emit tiny v0.1 utterance handoff fixtures for AquaSynth speech training.

This is intentionally not a Weksa runtime. It is a deterministic artifact
emitter for the first crawl-stage curriculum: simple IPA syllables with the
PanPhon 22-feature basis, fixed-width Weksa/Epiphany input vectors, and pending
AquaSynth-owned learned outputs.
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "examples" / "speech-training" / "tiny-panphon-v0.1"
VECTORS = OUT / "vectors"

SCHEMA_VERSION = "weksa.utterance_embedding_handoff.v0.1"
DECIDED_AT_UTC = "2026-05-20T00:00:00Z"

FEATURE_ORDER = [
    "syl",
    "son",
    "cons",
    "cont",
    "delrel",
    "lat",
    "nas",
    "strid",
    "voi",
    "sg",
    "cg",
    "ant",
    "cor",
    "distr",
    "lab",
    "hi",
    "lo",
    "back",
    "round",
    "velaric",
    "tense",
    "long",
]

PROSODY_HINT_LABELS = [
    "mean_pitch_pressure",
    "pitch_rise",
    "pitch_fall",
    "pitch_range",
    "loudness_pressure",
    "loudness_attack",
    "loudness_release",
    "speaking_rate",
    "articulation_precision",
    "pause_pressure",
    "phrase_final_lengthening",
    "stress_contrast",
    "clippedness",
    "breathiness",
    "creak_pressure",
    "smoothness",
    "warmth",
    "threat",
    "urgency",
    "hesitation",
    "irony_dryness",
    "tenderness",
    "contempt",
    "command_force",
    "question_contour",
    "exclamation_pressure",
    "secrecy_low_projection",
    "ritual_formality_pressure",
    "playful_pressure",
    "fatigue",
    "emotional_containment",
    "reserved",
]

CHARACTER_STATE_LABELS = [
    "valence",
    "arousal",
    "dominance",
    "urgency",
    "anger",
    "despair",
    "sadness",
    "fear",
    "anxiety",
    "disgust",
    "contempt",
    "annoyance",
    "dismissal",
    "flippancy",
    "playfulness",
    "irony",
    "tenderness",
    "warmth",
    "joy",
    "excitement",
    "fatigue",
    "guardedness",
    "confidence",
    "shame",
    "pride",
    "threat",
    "secrecy",
    "hesitation",
    "emotionalContainment",
    "thoughtPressure",
    "reactionIntensity",
    "commandForce",
    "currentLoad",
    "initiativeHeat",
    "pendingTurn",
    "cooldownPressure",
    "reactionBias",
    "interruptThreshold",
    "initiativeSpeed",
    "voiceBubbly",
    "voiceDryness",
    "voiceFormality",
    "voiceDirectness",
    "voiceIntensity",
    "voiceWarmth",
    "voicePrecision",
    "voiceRitualRegister",
    "presentationPushiness",
    "presentationSelfFocus",
    "presentationPlay",
    "presentationCareDemand",
    "behaviorWorkDrive",
    "behaviorBoundaryDefense",
    "behaviorPurityDrive",
    "behaviorPatience",
    "stableAgreeableness",
    "stableConscientiousness",
    "stableNeuroticism",
    "stableOpenness",
    "organizationCoherence",
    "organizationRigidity",
    "slowTraitReserved62",
    "slowTraitReserved63",
    "slowTraitReserved64",
]

PHONE_FEATURES = {
    "a": {
        "syl": 1,
        "son": 1,
        "cons": -1,
        "cont": 1,
        "voi": 1,
        "lo": 1,
        "round": -1,
        "tense": -1,
    },
    "p": {
        "syl": -1,
        "son": -1,
        "cons": 1,
        "cont": -1,
        "voi": -1,
        "lab": 1,
    },
    "t": {
        "syl": -1,
        "son": -1,
        "cons": 1,
        "cont": -1,
        "voi": -1,
        "ant": 1,
        "cor": 1,
    },
    "k": {
        "syl": -1,
        "son": -1,
        "cons": 1,
        "cont": -1,
        "voi": -1,
        "back": 1,
    },
    "s": {
        "syl": -1,
        "son": -1,
        "cons": 1,
        "cont": 1,
        "strid": 1,
        "voi": -1,
        "ant": 1,
        "cor": 1,
    },
    "m": {
        "syl": -1,
        "son": 1,
        "cons": 1,
        "cont": -1,
        "nas": 1,
        "voi": 1,
        "lab": 1,
    },
}

UTTERANCES = [
    ("open-vowel-a", "a", ["a"], "open low vowel baseline"),
    ("bilabial-pa", "pa", ["p", "a"], "voiceless bilabial stop into open vowel"),
    ("alveolar-ta", "ta", ["t", "a"], "voiceless alveolar stop into open vowel"),
    ("velar-ka", "ka", ["k", "a"], "voiceless velar stop into open vowel"),
    ("sibilant-sa", "sa", ["s", "a"], "voiceless alveolar sibilant into open vowel"),
    ("nasal-ma", "ma", ["m", "a"], "voiced bilabial nasal into open vowel"),
]


def feature_vector(phone: str) -> list[float]:
    features = PHONE_FEATURES[phone]
    return [float(features.get(name, 0)) for name in FEATURE_ORDER]


def frame(phone: str, index: int, count: int) -> dict:
    is_vowel = PHONE_FEATURES[phone].get("syl") == 1
    duration_ms = 180 if is_vowel else 95
    return {
        "index": index,
        "phone": phone,
        "features": feature_vector(phone),
        "markers": {
            "stress": 1.0 if is_vowel else 0.0,
            "length": 0.0,
            "tone": 0.0,
            "boundary": 1.0 if index == count - 1 else 0.0,
            "duration_ms": duration_ms,
        },
    }


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def packet(packet_id: str, ipa: str, phones: list[str], note: str) -> dict:
    prosody_values = [0.0] * 32
    prosody_values[7] = -0.15
    prosody_values[8] = 0.35
    prosody_values[11] = 0.2
    prosody_values[15] = 0.25

    return {
        "schema_version": SCHEMA_VERSION,
        "packet_id": f"tiny-panphon-v0.1/{packet_id}",
        "source_output_ref": "examples/speech-training/tiny-panphon-v0.1/README.md",
        "speaker_agent_id": "neutral-human-baseline",
        "text": {
            "spoken_text": ipa,
            "normalized_text": ipa,
            "channel_note": "Pure IPA curriculum seed; semantic text embedding is intentionally zero.",
        },
        "inputs": {
            "speech_text_embedding": {
                "model_id": "bge-m3:latest",
                "dimensionality": 1024,
                "values_ref": "vectors/zero-semantic-1024.json",
            },
            "panphon_sequence": {
                "model_id": "panphon.v0.1.seed",
                "source": "hand-authored seed phones for AquaSynth crawl-stage parity tests",
                "ipa": ipa,
                "feature_order": FEATURE_ORDER,
                "frames": [frame(phone, i, len(phones)) for i, phone in enumerate(phones)],
            },
            "prosody_emphasis_hints": {
                "dimensionality": 32,
                "labels": PROSODY_HINT_LABELS,
                "values": prosody_values,
            },
            "character_state_vector": {
                "source": "epiphany.agent_utterance_state.v0 neutral baseline",
                "schema_ref": "E:/Projects/EpiphanyAgent/schemas/agent-utterance-state-schema.md",
                "dimensionality": 64,
                "values_ref": "vectors/neutral-character-64.json",
            },
        },
        "phonetic_realization_embedding": {
            "owner": "AquaSynth",
            "model_id": "aquasynth.panphon_sequence_encoder.v0.1",
            "dimensionality": 256,
            "status": "pending_aquasynth_training_or_encoding",
            "values_ref": None,
        },
        "utterance_embedding": {
            "owner": "AquaSynth",
            "model_id": "aquasynth.utterance_embedding_encoder.v0.1",
            "version": None,
            "training_set": "tiny-panphon-v0.1",
            "dimensionality": 64,
            "status": "pending_aquasynth_training_or_encoding",
            "values_ref": None,
        },
        "audit_projection": {
            "semantic_preservation": "No lexical semantics; preserve the requested IPA sound shape.",
            "emphasis": "Single syllable baseline stress where a vowel exists.",
            "prosody": "Neutral, slow, precise, no expressive contour.",
            "character_pressure": "Neutral speaker baseline.",
            "delivery_shape": note,
        },
        "training_refs": {
            "positive_examples": [
                {
                    "kind": "reference_synth_prompt",
                    "engine": "eSpeak NG or equivalent baseline speech oracle",
                    "text": ipa,
                }
            ],
            "negative_examples": [],
        },
        "trace": {
            "pipeline_receipts": [
                {
                    "stage": "weksa_emit_tiny_panphon_handoff",
                    "decided_at_utc": DECIDED_AT_UTC,
                    "latency_budget_ms": 10,
                    "observed_latency_ms": 0,
                    "confidence": 0.72,
                }
            ],
            "notes": [
                "This fixture is a crawl-stage training seed, not a full English lowering artifact.",
                "The schema uses PanPhon's 22-feature basis; these seed values are hand-authored for the six seed phones until Weksa wires a canonical PanPhon dependency.",
                "AquaSynth owns the learned 256-float phonetic realization embedding and 64-float utterance embedding.",
            ],
            "uncertainties": [
                "Feature values should be regenerated from the canonical PanPhon library before broad phoneme coverage.",
                "Durations are seed timing hints, not measured reference audio.",
            ],
        },
    }


def emit() -> None:
    write_json(
        VECTORS / "zero-semantic-1024.json",
        {
            "model_id": "bge-m3:latest",
            "dimensionality": 1024,
            "values": [0.0] * 1024,
            "reason": "Pure IPA fixture; semantic text channel is intentionally silent.",
        },
    )
    write_json(
        VECTORS / "neutral-character-64.json",
        {
            "source": "epiphany.agent_utterance_state.v0 neutral baseline",
            "dimensionality": 64,
            "labels": CHARACTER_STATE_LABELS,
            "values": [0.0] * 64,
        },
    )

    packet_refs = []
    for packet_id, ipa, phones, note in UTTERANCES:
        path = OUT / f"{packet_id}.json"
        write_json(path, packet(packet_id, ipa, phones, note))
        packet_refs.append(path.name)

    write_json(
        OUT / "batch.json",
        {
            "schema_version": "weksa.utterance_handoff_batch.v0.1",
            "batch_id": "tiny-panphon-v0.1",
            "packet_schema_version": SCHEMA_VERSION,
            "packet_refs": packet_refs,
            "purpose": "Initial AquaSynth parity curriculum for simple IPA sounds.",
        },
    )


if __name__ == "__main__":
    emit()
