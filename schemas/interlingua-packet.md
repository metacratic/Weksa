# Interlingua Packet Contract

This is the human-facing schema receipt for Weksa interlingua packets.

Executable schema code does not exist yet. When it does, it must reconcile with
this document and [Interlingua Standard](../docs/interlingua-standard.md) in the
same pass.

## Authority

The interlingua packet is the boundary between clients and language projects.

Clients submit structured meaning. Language projects consume that meaning,
project it through ontology, and render it through grammar, morphology,
phonology, diachrony, and renderer rules.

## Required Fields

- `interlingua_version`: version string.
- `packet_id`: stable local identifier.
- `kind`: broad use case.
- at least one semantic payload family:
  - `referents`
  - `predications`
  - `relations`

## Optional Families

- `provenance`: source and confidence.
- `context`: world, scene, medium, participants, audience.
- `discourse`: speech act, intent, tone, source-side register hint.
- `constraints`: downstream requirements.
- `extensions`: namespaced client or setting pressure.
- `trace`: debug and authoring notes.

## Extension Contract

Extensions use explicit namespaces such as:

- `zyphos.*`
- `rtd.*`
- `game.*`
- `authoring.*`

Extensions are not a junk drawer. They are provisional fields awaiting evidence.
If a field becomes common across clients, promote it into the standard with a
version bump.

## Validation Goals

The eventual executable schema should validate:

- required top-level fields
- referential integrity between roles and referents
- known `kind` values
- namespace syntax for extensions
- deterministic JSON/YAML serialization
- stable packet IDs inside a corpus or run
- absence of target-language surface forms in source meaning fields

It should warn, not fail, on unknown extension namespaces unless a runtime bundle
declares a stricter policy.

