# Architecture

Weksa is currently a state spine and a pipeline map, not an implementation.

## Objective

Build a procedural alien-language engine whose outputs are grounded in
worldview, semantics, grammar, phonology, morphology, and history.

## Current Mechanism

There is no runtime mechanism yet. The repo contains persistent state surfaces
that define the intended data flow and the ownership boundaries future code must
respect.

## Invariants

- Meaning precedes words.
- Ontology owns concept distinctions.
- Grammar owns obligatory expression.
- Morphology owns form families.
- Phonology owns sound legality.
- Diachrony owns plausible irregularity.
- Renderer owns output, not interpretation.

## Intended Change

Future implementation should turn the pipeline in `state/map.yaml` into a small,
inspectable machine. The first executable slice should probably read a tiny
language project definition, render a handful of structured meaning packets, and
produce traceable glossed output.

Runtime should be fast and deterministic. Model-assisted English decomposition
belongs in authoring tools or offline import flows, not in the required hot path.
See [Runtime and Authoring Split](./runtime-authoring-split.md).

## Cut Line

Do not add a runtime language, service, database, queue, plugin system, prompt
framework, or adapter until the pipeline stage needing it is known.

Do not hard-code Rust to Dust, its aliens, or its aesthetic-honor ontology into
the generic engine.
