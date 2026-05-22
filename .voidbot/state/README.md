# Weksa Typed Face State

`weksa.cc` is Weksa's canonical repo Face state. It is a CultCache `.cc`
store using VoidBot's typed self-state schema:

- `void.self_profile`
- `void.thought_memory`
- `void.agency_pressure`
- `void.face_affect`
- supporting runtime, receipt, cursor, and candidate documents

Do not edit `.cc` bytes directly. Use VoidBot typed operations through
`E:\Projects\VoidBot\scripts\void-self-state.mjs apply-operation` or an
equivalent typed service call.

`weksa-birth-seed-operations.json` is the birth seed provenance packet used to
initialize Weksa's starting profile, durable memories, affect, agency pressure,
social/status reads, and mood dimensions. It is source material, not a working
projection of state.

