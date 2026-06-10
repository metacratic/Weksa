# Cultural Ontology Store

This directory holds draft Weksa cultural and subcultural ontology profiles used
for ontological lowering, syntax, grammar, discourse, and surface-affordance
selection.

Live pipeline shape:

1. Weksa stores reusable cultures/subcultures here and in semantic retrieval
   storage such as Qdrant.
2. A Persona state references the relevant culture stack.
3. The Persona produces interlingua intent from current state and situation.
4. Weksa lowers that interlingua through the referenced culture stack.

Persona state owns current intent, memory pressure, and relationship stance.
Cultural ontology owns reusable salience, affordances, and constraints. Qdrant
may retrieve candidates, but accepted ontology remains typed state.
