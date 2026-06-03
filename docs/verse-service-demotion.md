# Verse Service Demotion

Weksa is not currently an active Verse service.

## Verification

The current repo body is a state spine, documentation set, examples, and one
fixture emitter:

- `state/map.yaml` owns the slow project map.
- `schemas/` owns human-facing contract receipts.
- `examples/` owns fixture evidence.
- `tools/emit_tiny_panphon_handoffs.py` emits bounded AquaSynth handoff
  fixtures.

There is no daemon, server loop, package entry point, service supervisor,
CultMesh provider, CultNet transport, Eve projection runtime, or executable
compiler service. The architecture docs explicitly keep runtime language,
service scaffolding, storage, queues, and plugin systems out of scope until a
pipeline stage earns them.

## Demotion

No Verse service migration is due while Weksa remains a tool/library-shaped
workspace. Do not add a provider advertisement fixture, export command, or
service contract merely to satisfy the shape of future infrastructure. That
would make a dashboard for a machine that does not exist yet, which is how the
altar gets sticky.

The current executable surface remains a bounded fixture tool, not a daemon:

```powershell
python tools/emit_tiny_panphon_handoffs.py
```

## Future Service Expectations

If Weksa becomes a language/compiler service, the first service pass should
publish a small Verse contract that names only real owned surfaces:

- CultCache witnesses:
  - project/compiler state `.cc`
  - language-project state `.cc`
  - interlingua packet witness `.cc`
  - lowering/render trace witness `.cc`
  - pronunciation or utterance-handoff witness `.cc` when that pipeline is
    active
- CultMesh provider surfaces:
  - service identity and version
  - accepted schema versions
  - available language projects
  - compile/render job status
  - recent witness exports
- Eve surfaces:
  - compact TUI status for agent inspection
  - GUI composition for language projects, schemas, traces, and witness review
- Commands:
  - validate interlingua packet
  - compile/load language project
  - render packet through a selected language project
  - export typed witness
  - advertise provider contract

Those commands must delegate to the same commit or derivation paths used by any
CLI or library API. Manual actions, programmatic jobs, fixture exports, and
future Eve controls must not become separate truths.
