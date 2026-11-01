# Product captures

These assets show Project Mode v0.1.22 running with the compatible DeepSeek Harness 0.2.1-rc.3 runtime, captured on 2026-11-02. The captures use the installed Desktop Host and its native Web UI in a local browser. No runtime code was changed for capture, and no product UI was mocked or generated.

Project Atlas is a fictional workspace for a CLI note exporter. Two real Worker conversations reviewed a small release brief, returned results to the Coordinator, and handled a second handoff request. The fixture's test counts and release claims are fictional inputs, not verified results or plugin benchmarks.

| File | What it shows |
| --- | --- |
| `project-workspace.png` | Coordinator response, native Worker branches, result capsules and the notes tab. |
| `worker-timeline.png` | Native panel crop: two Worker turns, original input, final AI output and recorded artifacts. |
| `project-notes.png` | Native panel crop: the Coordinator-maintained `notes.md`. |
| `project-mode-demo.gif` | Silent, looping UI navigation after both Worker turns completed. |
| `project-mode-demo.mp4` | The same approximately 22-second walkthrough, with player controls. |

The stills are direct browser-content captures. The video records actual panel and conversation navigation at 2.5 frames per second; it does not depict live model generation or imply task completion speed. GIF and MP4 are scaled encodings of the same captured frames. Worker's inputs and outputs are the original conversation content.

Private workspace groups were collapsed before capture. Only the fictional Project Atlas conversation and its Workers appear. No personal conversation, account identifier, credential or private filesystem path is included. `/private/tmp/project-atlas-demo` and the Project UUID visible in the UI belong only to this fixture.

Project-authored demo content and media may be reused under this repository's MIT license. DeepSeek Harness branding and native UI remain attributable to DeepSeek; their appearance does not imply endorsement.
