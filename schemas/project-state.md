# Project State

Weksa's project state is the durable memory surface for the workspace.

It exists to keep architecture, decisions, invariants, and evidence separate
from chat transcript fog. This is the EpiphanyAgent persistent-state pattern,
trimmed down before it starts making grand claims in a hallway mirror.

## Files

- `state/map.yaml`: canonical, slow-changing project map.
- `state/scratch.md`: disposable workbench.
- `schemas/`: human-readable state contracts.
- `docs/`: explanatory design documents.

## Map Shape

`state/map.yaml` currently carries:

- `project`: name, status, phase, premise
- `objective`: primary and current objective
- `constraints`: live boundaries
- `invariants`: statements that must remain true
- `data_flow`: observe, process, and cut model
- `pipeline`: stages and edges
- `accepted_design`: durable decisions
- `open_questions`: unresolved design pressure
- `landed_baseline`: completed scaffold state

## Policy

- The map is not an activity log.
- Scratch is not canonical.
- Accepted design should describe the live system, not celebrate old wounds.
- Evidence belongs here only when it changes future behavior.
- Runtime scaffolding should not appear until ownership and data flow justify
  it.
