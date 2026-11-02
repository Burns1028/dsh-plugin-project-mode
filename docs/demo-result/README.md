# Actual Note Bundle result

These files were produced during a real model/UI run on 2026-11-02 using the isolated Project Mode 0.1.23 runtime on macOS arm64 and DSH 0.2.1-rc.3. The [starter](../../examples/note-bundle) contains the original unfinished task; the [workflow](../demo-workflow.md) gives the exact human messages.

The human changed title sorting from A-to-Z to Z-to-A directly in Exporter's conversation while it was busy. Native input queued the update, and Exporter completed another turn. The Coordinator received the result, inspected current state and aligned the documentation. A later request added Cherries using the existing Workers and accepted contract, without the human repeating the order.

Independent final verification: **9 tests passed, 0 failed**, Node 24.19.0. Two Worker identities were reused; both were idle and the Coordinator turn was closed at the end. The original baseline had 3 passing tests and 1 deliberately failing feature test. No package dependencies or commits were added to the sample.

```sh
node --test test/*.test.mjs
node note-bundle.mjs notes --sort title
node note-bundle.mjs notes
```

Accepted output headings: `Pears`, `Cherries`, `Bananas`, `apples`. Default filename order: `Pears`, `apples`, `Bananas`, `Cherries`.

- [Generated document](output.md)
- [Usage guide](usage.md)
- [Coordinator work records](memory/notes.md) / [concluded work](memory/archived.md)
- [Shared context index](memory/context/context.md) / [accepted CLI contract](memory/context/cli-contract.md)
- [60-second edited recording](../media/project-workflow.mp4), with waits explicitly omitted

This is a small synthetic, reproducible example, not evidence of universal delegation quality or a speed benchmark. The copied result keeps the original paths and wording in the memory documents; the original generated `dist/notes.md` is named `output.md` here for GitHub browsing.
