# Native integration contracts

Run `npm run test:native-contract` separately from the default suite after explicitly preparing the native extensions described in [compatibility](../../docs/compatibility.md).

- `standard-tool-isolation.spec.ts` uses actual native tool registration, preset composition and model request assembly. It checks Coordinator-only tool suppression plus Worker/ordinary preservation and restoration on disable/disposal.
- `sidebar-branch.spec.tsx` loads the original native workspace browser and real slot renderer. It checks the additive branch seam, native row behavior, ordinary-row preservation and Project parent/child alignment.

Stock rc.3 lacks the required extensions and the plugin explicitly refuses to enable without them. These tests validate the prepared runtime; they do not claim upstream compatibility or replace real application acceptance.

See [current verification](../../docs/verification.md), [manual application checks](../../docs/manual-verification.md) and [the contributor test map](../../CONTRIBUTING.md).
