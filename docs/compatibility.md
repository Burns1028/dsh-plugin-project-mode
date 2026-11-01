# Compatibility

Target: DSH 0.2.1-rc.3, Node 24.9+. Stock rc.3 is incompatible. These are local compatibility extensions, not claims of upstream acceptance:

1. Agent-local `tools.suppress({ deny })`, including tools registered on that Agent, with reversible disposal.
2. Per-session `conversation.submission.register(sessionId, "steer")`, leaving global preferences untouched.
3. `sidebar.workspaces.session.branch`, allowing native parent/child row rendering without replacing the workspace browser.

The audited files and before/after SHA-256 hashes live in `compat/rc3/manifest.json`. npm and Desktop client builds have separate variants. `scripts/apply-native-compat.mjs` refuses unknown versions, unknown bytes and mixed states, preflights every patch, requires an explicit backup before changes and rolls back failed application.

For this checkout, install dependencies and run the helper explicitly:

```sh
node scripts/apply-native-compat.mjs --dry-run
node scripts/apply-native-compat.mjs --backup /absolute/path/to/native-backup
```

For a separate unpacked runtime, provide `--modules /absolute/path/to/runtime/node_modules`; add `--runtime-only` only for a distribution that contains JS without declarations. Preserve a full application/runtime backup before changing a Desktop installation. The helper does not locate, unpack, sign, restart or edit an application, profile, conversation or global preference automatically.

There are no install/prepare lifecycle hooks. A DSH update requires fresh compatibility review; never blindly apply rc.3 patches to another version. To revert, stop the affected runtime, restore exactly the files from its backup and remove the plugin through its native plugin manager.
