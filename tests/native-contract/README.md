# Real Standard tool-isolation contract check

Run `npm run test:native-contract` separately from the default test suite, after explicitly preparing the local native compatibility APIs described in [compatibility](../../docs/compatibility.md).

With the user-authorized local `tools.suppress({ deny })` API, both Standard model-selection variants pass. The test uses actual native tool registration, settings, retained preset composition, and model request assembly; ordinary/worker preservation and same-Agent disable/unload restoration checks remain enabled.

The original published rc.3 API lacked this capability. The 2026-10-28 run failed two cases with six schema/request visibility assertions; that is historical RED evidence, not an expected-failure inversion or a claim that stock rc.3 now works. The plugin now explicitly rejects a runtime missing the required API.

See [current verification](../../docs/verification.md), [the historical API investigation](../../docs/standard-tool-isolation.md), and [the earlier application report](../../docs/acceptance/2026-10-28/REPORT.md). Current Desktop UI acceptance is still pending.
