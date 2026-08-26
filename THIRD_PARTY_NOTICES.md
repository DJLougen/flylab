# Third-party notices

This file records the third-party data and software incorporated into FlyLab. It is an attribution record, not a replacement for FlyLab's own [Apache License 2.0](LICENSE).

## BANC v888 connectome data

FlyLab includes a small canonical table slice and six simplified render derivatives from the Brain and Nerve Cord Connectome (BANC) `banc_888` snapshot dated 2026-04-17.

- Article: Bates AS, Phelps JS, Kim M, Yang HHJ, et al. (2026), “Distributed control circuits across a brain-and-cord connectome,” *Nature*. <https://doi.org/10.1038/s41586-026-10735-w>
- Dataset: BANC static dataset, Harvard Dataverse version 3.0. <https://doi.org/10.7910/DVN/7WTH1N>
- Released-data documentation: <https://github.com/htem/bancpipeline#released-data-products>
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)

Changes made by FlyLab:

- Selected the four metadata rows labeled `MDN`, the two rows labeled `LBL40`, and the four directed MDN→LBL40 edge rows between them.
- Normalized boolean fields and added FlyLab provenance labels in the canonical JSON slice.
- Converted six L2 SWC skeletons to compact Float32 line-segment assets using one documented coordinate transform and a topology-preserving simplification rule that retains roots, branch points, endpoints, and path-spaced intermediate nodes.
- Added a schematic CNS orientation shell. The shell is not BANC data or a BANC neuropil mesh.

The exact source URLs, source hashes, counts, transform, and scientific limitations are recorded in `public/data/banc-v888-skeletons/manifest.json`, `public/data/banc-v888-skeletons/README.md`, and `docs/BANC_SLICE_REPRODUCIBILITY.md`.

## Open-source software

FlyLab depends on open-source software distributed under its respective licenses, including React, Next.js, Three.js, Vite/Vinext, Tailwind CSS, and Cloudflare tooling. Package names and pinned versions are recorded in `package.json` and `package-lock.json`.

The generated [dependency, build-artifact, and license bundle](THIRD_PARTY_LICENSES.txt) records the exact production dependency graph, reviewed build-tool packages whose code or runtime helpers are emitted into the deployable artifact, upstream license texts, the complete Geist/Geist Mono SIL Open Font License 1.1 notice, and its copyright statement. The same file is deployed at [`/THIRD_PARTY_LICENSES.txt`](public/THIRD_PARTY_LICENSES.txt). Run `npm run licenses:generate` after a production dependency, build pipeline, or bundled-font change; `npm run build` verifies that both source copies are current and that the public copy survives into the built site.

## Project media

The social-preview image at `public/og.png` is a capture of FlyLab's own public interface and procedural Three.js fly. It replaces an earlier untracked illustration so the submitted media has an explicit, reviewable origin. The included Geist/Geist Mono font use is covered by the SIL Open Font License 1.1 text in `THIRD_PARTY_LICENSES.txt`.

The demo builder does not synthesize or record a macOS System Voice. It requires separately supplied per-segment narration clips plus an explicit `FLYLAB_NARRATION_RIGHTS_CONFIRMED=1` build-time confirmation. Use the entrant's own recording or audio with express public and commercial publication rights; do not include unlicensed music or voice assets.
