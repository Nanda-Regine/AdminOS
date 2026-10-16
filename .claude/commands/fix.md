---
description: Fix a bug properly — reproduce with a failing test, find the root cause, fix, prove, check for siblings.
argument-hint: <bug description>
---
Fix this bug: $ARGUMENTS

1. Branch `fix/<slug>`. `scout` maps the area.
2. `qa-engineer` writes a test that reproduces the bug. Run it — it must fail. If you can't reproduce, stop and tell me what you tried.
3. Find the **root cause**, not the symptom. State it in one sentence: "X happens because Y."
4. Fix it in the right layer with the smallest correct change.
5. Run the reproduce test — it must now pass. Run all gates.
6. Search the codebase for the same pattern elsewhere (sibling bugs). Fix or list them.
7. `security-auditor` reviews if the fix touches auth, data, payments or AI.
8. `verifier` confirms. `scribe` adds a CHANGELOG line and a short proof note.
9. Report: cause, fix, proof, siblings found.
