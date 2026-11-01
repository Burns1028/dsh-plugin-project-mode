# Verification

Current source: 0.1.22, 2026-11-02. DSH 0.2.1-rc.3 with the same three explicit compatibility extensions. No additional native patch, public/storage schema change, prompt routing gate or human read/ack state was added.

## Maintenance fixes

- A real native regression reproduces a one-time Project A recovery read failure, then verifies Project B and Project A can finish later turns normally. A second regression verifies current Worker work still holds closure until its canonical result is consumed after a background warning.
- Native capacity rejection leaves an internal failed-provisioning record, but Coordinator list and public snapshots now omit it. A real Worker whose model execution fails remains an active, visible member.
- Host event bindings, mode lifecycle and pure snapshot assembly are separated; native mode locking, permissions, dispatch, Stop, result recovery and capsule anchors are exercised by the existing integration regressions.

The earlier audit confirmed both defects in 0.1.21; those findings are now covered by the above fix regressions. Fresh production build and **35 files / 142 tests**, Host/Client typechecks, and **2 files / 8 native contracts** passed. Fresh npm, Git-forwarder and Git consumers passed native loading, Remote roundtrips, declarations and disposal; clean-checkout npm ci also passed. An independent source review found no actionable issues and confirmed generated Remote descriptors were unchanged apart from source-location metadata.

## Desktop 0.1.22 real-model smoke

A separately installed 0.1.22 bundle ran in a new temporary workspace under Desktop 0.2.1-rc.3. The Coordinator called list then spawn; one Worker wrote two reusable facts and updated the shared index. The full final committed Worker AI payload matched the canonical received result exactly. There was one Worker turn, one Coordinator turn, one canonical result and a completed native Coordinator closure after 50 seconds, with result consumption before closure. The Coordinator independently read the index/facts and updated notes/archived. The visible capsule and collapsed Markdown timeline were inspected.

The initial timeline observation briefly returned a native session-not-found error for the newly created Worker; the existing Retry action recovered the timeline. This UI read timing issue remains a limitation and is separate from the fixed turn/error-isolation path. The task explicitly requested delegation, so it does not establish general natural-delegation quality. No test prompt was sent to an existing user conversation.

## 0.1.21 historical verification

Baseline: DSH 0.2.1-rc.3 with the repository's three explicit compatibility extensions; Node 24.19.0. Version: 0.1.21.

- Production build and 34 Host/Client/integration files: 139 tests passed.
- Host and Client typechecks passed.
- 2 native-contract files: 8 tests passed, using real native loader/renderer and original workspace browser.
- New regressions cover missing legacy context indexes, permission-denied nonblocking backfill, scoped native filesystem usage, shared Worker index updates, idle sidebar spacing, collapsed Markdown and the single empty panel state.
- A real Desktop model task in an isolated Project dispatched a Worker, wrote two reusable facts and updated the shared index. The Coordinator received the canonical final reply, checked the index/facts and updated notes/archived. One native Coordinator turn closed after 58 seconds.

The real model task explicitly asked for Worker delegation. It proves the memory and completion chain, not reliable unrestricted natural delegation. Natural task ownership remains model-dependent. UI-only polish was checked separately after installation. Public package verification uses fresh npm and Git-forwarder consumers; raw private acceptance logs and screenshots are intentionally not distributed.

See manual-verification.md for checks to repeat on a new runtime. Stock rc.3 refusal and successful explicit compatibility installation are both expected package-consumer checks.
