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

FlyLab depends on open-source software distributed under its respective licenses, including React, Next.js, Three.js, Vite/Vinext, Tailwind CSS, and Cloudflare tooling. Package names and pinned versions are recorded in `package.json` and `package-lock.json`; their license texts and notices remain with their upstream distributions.
