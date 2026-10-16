---
description: Build a feature end-to-end with the full team — design, build, test, review, verify, prove.
argument-hint: <what to build>
---
Build this: $ARGUMENTS

Follow the workflow in CLAUDE.md exactly:
1. Create branch `feat/<slug>`. Create a task list.
2. `scout` maps the relevant code.
3. `architect` writes `docs/plans/<slug>.md` (acceptance criteria + risk register). Show me the acceptance criteria and any "Decisions for Nanda" — then continue unless a decision is blocking.
4. Engineers build in parallel where independent. Gates after each step.
5. `qa-engineer` writes tests from the risk register.
6. Reviewers in parallel on the diff: `security-auditor`, `ux-reviewer` (if UI), `compliance-officer` (if data/payments/AI/store), `performance-engineer` (if UI/queries).
7. Fix every Critical/High. Re-review only what changed.
8. `verifier` independently checks Definition of Done.
9. `scribe` writes the proof doc, CHANGELOG and BUILD_JOURNEY.
10. Tell me in plain language: what's done, what's proven, what needs my decision.
