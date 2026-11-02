# Changelog

## 0.1.23 — 2026-11-02

- Add an explicit isolated Web setup, start and read-only doctor CLI with a pinned native runtime lock, audited compatibility backup and recoverable owned setup.
- Keep the new runtime's DSH home, Agent configuration and default workspace separate from the normal Desktop installation.
- Add a dependency-free project task, trial feedback form, and first-run documentation for community testing.
- Publish a 60-second edited real-task recording, independently verified result files and the shared context used by the follow-up task.
- Project coordination and native execution behavior are unchanged from 0.1.22.

## 0.1.22 — 2026-11-02

- Remove sticky global error bookkeeping that could poison unrelated Project turns after a recovered background failure. Current Project assignments, native activity and canonical result delivery still govern closure.
- Use one membership predicate for Coordinator list, public snapshots and Client lists. Failed creation placeholders remain internal; existing Workers with failed execution stay visible.
- Separate native Agent event bindings, Project mode lifecycle and snapshot assembly from the Host entry point. Split Worker dispatch into lifecycle actions, durable intent preparation and native admission; preserve public/storage shapes.
- Clarify data ownership and contributor guidance; align bilingual READMEs with a capability table, quick start, usage guide and project structure.

## 0.1.21 — Initial public developer preview

- Persistent Coordinator and continuable Workers controlled through native DSH sessions.
- Shared progressive context index, Coordinator work records, full final-message return and native recovery deduplication.
- Turn and message-segment capsule ownership, Worker icons, native sidebar branches and Project family archival.
- Native right-side Worker timeline and notes preview; original Markdown inputs and final outputs are collapsed by default.
- Compact idle sidebar spacing, transparent Back control and no independent Worker permission picker.
- Explicit, hash-verified rc.3 compatibility patches and a generated installable Cordis bundle.

This public snapshot starts from a clean initial commit. Private development history and acceptance materials are not included.
