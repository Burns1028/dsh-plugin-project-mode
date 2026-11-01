# Verification

Baseline: DSH 0.2.1-rc.3 with the repository's three explicit compatibility extensions; Node 24.19.0. Version: 0.1.21.

- Production build and 34 Host/Client/integration files: 139 tests passed.
- Host and Client typechecks passed.
- 2 native-contract files: 8 tests passed, using real native loader/renderer and original workspace browser.
- New regressions cover missing legacy context indexes, permission-denied nonblocking backfill, scoped native filesystem usage, shared Worker index updates, idle sidebar spacing, collapsed Markdown and the single empty panel state.
- A real Desktop model task in an isolated Project dispatched a Worker, wrote two reusable facts and updated the shared index. The Coordinator received the canonical final reply, checked the index/facts and updated notes/archived. One native Coordinator turn closed after 58 seconds.

The real model task explicitly asked for Worker delegation. It proves the memory and completion chain, not reliable unrestricted natural delegation. Natural task ownership remains model-dependent. UI-only polish was checked separately after installation. Public package verification uses fresh npm and Git-forwarder consumers; raw private acceptance logs and screenshots are intentionally not distributed.

See manual-verification.md for checks to repeat on a new runtime. Stock rc.3 refusal and successful explicit compatibility installation are both expected package-consumer checks.
