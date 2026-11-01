# rc.3 compatibility extensions

See ../../docs/compatibility.md. The manifest pins exact native package versions and source hashes for Agent-local tool suppression, per-session composer submission preference and the additive native sidebar Session branch seam. These local extensions are not upstream API guarantees.

Run scripts/apply-native-compat.mjs explicitly with --dry-run first and --backup for application. It modifies only the selected node_modules. No lifecycle hook patches a user's application. Review again when upgrading DSH.
