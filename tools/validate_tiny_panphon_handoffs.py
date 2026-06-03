#!/usr/bin/env python3
"""Validate the tiny v0.1 utterance handoff fixtures.

This is a contract smoke, not a general schema runtime. It checks the current
training entrypoint and the fixed vector widths that AquaSynth is allowed to
depend on for `weksa.utterance_embedding_handoff.v0.1`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BATCH = ROOT / "examples" / "speech-training" / "tiny-panphon-v0.1" / "batch.json"

PACKET_SCHEMA_VERSION = "weksa.utterance_embedding_handoff.v0.1"
BATCH_SCHEMA_VERSION = "weksa.utterance_handoff_batch.v0.1"

SPEECH_TEXT_DIMENSIONALITY = 1024
PANPHON_FEATURE_DIMENSIONALITY = 22
PROSODY_DIMENSIONALITY = 32
CHARACTER_STATE_DIMENSIONALITY = 64
PHONETIC_REALIZATION_DIMENSIONALITY = 256
UTTERANCE_EMBEDDING_DIMENSIONALITY = 64


class ValidationError(ValueError):
    """Raised when a fixture violates the v0.1 handoff contract."""


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValidationError(f"Missing JSON file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValidationError(f"Invalid JSON in {path}: {exc}") from exc


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def require_object(value: Any, path: str) -> dict[str, Any]:
    require(isinstance(value, dict), f"{path} must be an object")
    return value


def require_list(value: Any, path: str) -> list[Any]:
    require(isinstance(value, list), f"{path} must be a list")
    return value


def require_dimensional_vector(
    node: dict[str, Any],
    *,
    path: str,
    dimensionality: int,
    allow_ref: bool,
    packet_dir: Path,
    require_zero: bool = False,
) -> None:
    require(node.get("dimensionality") == dimensionality, f"{path}.dimensionality must be {dimensionality}")

    values = node.get("values")
    values_ref = node.get("values_ref")

    if values is not None:
        vector = require_list(values, f"{path}.values")
        require(len(vector) == dimensionality, f"{path}.values must contain {dimensionality} values")
        require(all(isinstance(value, (int, float)) for value in vector), f"{path}.values must be numeric")
        if require_zero:
            require(all(value == 0.0 for value in vector), f"{path}.values must stay zeroed for pure IPA fixtures")
        return

    if allow_ref and values_ref:
        ref_path = (packet_dir / values_ref).resolve()
        ref = require_object(load_json(ref_path), str(ref_path))
        require(ref.get("dimensionality") == dimensionality, f"{ref_path}.dimensionality must be {dimensionality}")
        ref_values = require_list(ref.get("values"), f"{ref_path}.values")
        require(len(ref_values) == dimensionality, f"{ref_path}.values must contain {dimensionality} values")
        require(all(isinstance(value, (int, float)) for value in ref_values), f"{ref_path}.values must be numeric")
        if require_zero:
            require(all(value == 0.0 for value in ref_values), f"{ref_path}.values must stay zeroed for pure IPA fixtures")
        return

    raise ValidationError(f"{path} must contain values or values_ref")


def validate_pending_aquasynth_vector(node: dict[str, Any], *, path: str, dimensionality: int) -> None:
    require(node.get("owner") == "AquaSynth", f"{path}.owner must be AquaSynth")
    require(node.get("dimensionality") == dimensionality, f"{path}.dimensionality must be {dimensionality}")
    values_ref = node.get("values_ref")
    status = node.get("status")
    require(values_ref is None, f"{path}.values_ref must stay null until AquaSynth supplies learned output")
    require(status == "pending_aquasynth_training_or_encoding", f"{path}.status must mark pending AquaSynth output")


def validate_panphon_sequence(node: dict[str, Any], *, path: str) -> None:
    require(node.get("ipa"), f"{path}.ipa must not be empty")
    feature_order = require_list(node.get("feature_order"), f"{path}.feature_order")
    require(
        len(feature_order) == PANPHON_FEATURE_DIMENSIONALITY,
        f"{path}.feature_order must contain {PANPHON_FEATURE_DIMENSIONALITY} features",
    )

    frames = require_list(node.get("frames"), f"{path}.frames")
    require(frames, f"{path}.frames must not be empty")

    for index, raw_frame in enumerate(frames):
        frame = require_object(raw_frame, f"{path}.frames[{index}]")
        require(frame.get("index") == index, f"{path}.frames[{index}].index must match frame position")
        require(frame.get("phone"), f"{path}.frames[{index}].phone must not be empty")

        features = require_list(frame.get("features"), f"{path}.frames[{index}].features")
        require(
            len(features) == PANPHON_FEATURE_DIMENSIONALITY,
            f"{path}.frames[{index}].features must contain {PANPHON_FEATURE_DIMENSIONALITY} values",
        )
        require(
            all(value in (-1.0, 0.0, 1.0) for value in features),
            f"{path}.frames[{index}].features must use ternary PanPhon values",
        )

        markers = require_object(frame.get("markers"), f"{path}.frames[{index}].markers")
        for marker in ["stress", "length", "tone", "boundary", "duration_ms"]:
            require(isinstance(markers.get(marker), (int, float)), f"{path}.frames[{index}].markers.{marker} must be numeric")

    require(
        require_object(frames[-1], f"{path}.frames[-1]").get("markers", {}).get("boundary") == 1.0,
        f"{path}.frames[-1].markers.boundary must close the sequence",
    )


def validate_packet(packet_path: Path, expected_batch_id: str) -> None:
    packet = require_object(load_json(packet_path), str(packet_path))
    packet_dir = packet_path.parent

    require(packet.get("schema_version") == PACKET_SCHEMA_VERSION, f"{packet_path}.schema_version must be {PACKET_SCHEMA_VERSION}")
    require(str(packet.get("packet_id", "")).startswith(f"{expected_batch_id}/"), f"{packet_path}.packet_id must belong to {expected_batch_id}")
    require(packet.get("source_output_ref"), f"{packet_path}.source_output_ref must not be empty")
    require(packet.get("speaker_agent_id"), f"{packet_path}.speaker_agent_id must not be empty")

    text = require_object(packet.get("text"), f"{packet_path}.text")
    require(text.get("spoken_text") == text.get("normalized_text"), f"{packet_path}.text normalized_text must match pure IPA spoken_text")

    inputs = require_object(packet.get("inputs"), f"{packet_path}.inputs")
    speech_text_embedding = require_object(inputs.get("speech_text_embedding"), f"{packet_path}.inputs.speech_text_embedding")
    require(speech_text_embedding.get("model_id") == "bge-m3:latest", f"{packet_path}.inputs.speech_text_embedding.model_id must be bge-m3:latest")
    require_dimensional_vector(
        speech_text_embedding,
        path=f"{packet_path}.inputs.speech_text_embedding",
        dimensionality=SPEECH_TEXT_DIMENSIONALITY,
        allow_ref=True,
        packet_dir=packet_dir,
        require_zero=True,
    )

    validate_panphon_sequence(require_object(inputs.get("panphon_sequence"), f"{packet_path}.inputs.panphon_sequence"), path=f"{packet_path}.inputs.panphon_sequence")

    prosody = require_object(inputs.get("prosody_emphasis_hints"), f"{packet_path}.inputs.prosody_emphasis_hints")
    require(len(require_list(prosody.get("labels"), f"{packet_path}.inputs.prosody_emphasis_hints.labels")) == PROSODY_DIMENSIONALITY, f"{packet_path}.inputs.prosody_emphasis_hints.labels must contain {PROSODY_DIMENSIONALITY} labels")
    require_dimensional_vector(
        prosody,
        path=f"{packet_path}.inputs.prosody_emphasis_hints",
        dimensionality=PROSODY_DIMENSIONALITY,
        allow_ref=False,
        packet_dir=packet_dir,
    )

    character_state = require_object(inputs.get("character_state_vector"), f"{packet_path}.inputs.character_state_vector")
    require_dimensional_vector(
        character_state,
        path=f"{packet_path}.inputs.character_state_vector",
        dimensionality=CHARACTER_STATE_DIMENSIONALITY,
        allow_ref=True,
        packet_dir=packet_dir,
    )

    validate_pending_aquasynth_vector(
        require_object(packet.get("phonetic_realization_embedding"), f"{packet_path}.phonetic_realization_embedding"),
        path=f"{packet_path}.phonetic_realization_embedding",
        dimensionality=PHONETIC_REALIZATION_DIMENSIONALITY,
    )
    validate_pending_aquasynth_vector(
        require_object(packet.get("utterance_embedding"), f"{packet_path}.utterance_embedding"),
        path=f"{packet_path}.utterance_embedding",
        dimensionality=UTTERANCE_EMBEDDING_DIMENSIONALITY,
    )

    require_object(packet.get("audit_projection"), f"{packet_path}.audit_projection")
    require_object(packet.get("training_refs"), f"{packet_path}.training_refs")
    require_object(packet.get("trace"), f"{packet_path}.trace")


def validate_batch(batch_path: Path) -> list[Path]:
    batch = require_object(load_json(batch_path), str(batch_path))
    require(batch.get("schema_version") == BATCH_SCHEMA_VERSION, f"{batch_path}.schema_version must be {BATCH_SCHEMA_VERSION}")
    require(batch.get("packet_schema_version") == PACKET_SCHEMA_VERSION, f"{batch_path}.packet_schema_version must be {PACKET_SCHEMA_VERSION}")
    batch_id = batch.get("batch_id")
    require(isinstance(batch_id, str) and batch_id, f"{batch_path}.batch_id must not be empty")

    packet_refs = require_list(batch.get("packet_refs"), f"{batch_path}.packet_refs")
    require(packet_refs, f"{batch_path}.packet_refs must not be empty")

    packet_paths = [(batch_path.parent / ref).resolve() for ref in packet_refs]
    for packet_path in packet_paths:
        validate_packet(packet_path, batch_id)
    return packet_paths


def main(argv: list[str]) -> int:
    batch_path = Path(argv[1]).resolve() if len(argv) > 1 else DEFAULT_BATCH
    try:
        packet_paths = validate_batch(batch_path)
    except ValidationError as exc:
        print(f"validation failed: {exc}", file=sys.stderr)
        return 1

    print(f"validated {len(packet_paths)} packet(s) from {batch_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
