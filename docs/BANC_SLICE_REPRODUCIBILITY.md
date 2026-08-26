# Reproducing the BANC v888 circuit slice

FlyLab's runtime uses a deliberately small structural slice of the BANC version 3.0 `banc_888` release: four MDNs, two LBL40 cells, and the four directed MDN→LBL40 rows between them. The checked-in canonical extraction is [`data/banc-v888-mdn-lbl40-slice.json`](../data/banc-v888-mdn-lbl40-slice.json). The large Feather source files are not part of this repository.

## Source inputs

Download these two files from the [BANC Dataverse version 3.0 release](https://doi.org/10.7910/DVN/7WTH1N) into one local directory, retaining the exact filenames:

| File | Dataverse file ID | Bytes | SHA-256 |
|---|---:|---:|---|
| `banc_888_meta.feather` | `14033740` | 57,550,610 | `819bbcff476e52702d6f8d8604ce1f12d1d7b11942281df2f49df2a73a6f15a5` |
| `banc_888_edgelist_simple_v3.feather` | `13918810` | 359,161,658 | `8c296e946f3c69a8c7222f30ad75fa8a98eeb189124fec6df829c9125f4be64b` |

Keep these raw files outside the repository. The verifier reads them in place and does not copy them into the project.

## Verify the extraction

The script requires Python 3.9 or newer and Apache Arrow. The extraction committed here was verified with `pyarrow==21.0.0`.

```bash
python3 -m pip install 'pyarrow==21.0.0'
python3 scripts/verify-banc-v888-slice.py /path/to/banc-v888-files
```

The default mode is read-only. It checks both source sizes, MD5 hashes, and SHA-256 hashes before extraction, then confirms the raw row counts while reading the tables. It then:

1. selects every metadata row whose `cell_type` is exactly `MDN` or `LBL40`;
2. verifies that this produces the pinned four-MDN/two-LBL40 inventory and normalizes the Feather boolean strings;
3. selects directed edges whose `pre` is one of those MDNs and whose `post` is one of those LBL40 cells;
4. verifies the exact four `(pre, post, count)` tuples and their 153-contact total; and
5. performs a byte-for-byte comparison with the canonical JSON artifact.

To deliberately regenerate the small artifact after reviewing a source or extraction change, add `--write`:

```bash
python3 scripts/verify-banc-v888-slice.py /path/to/banc-v888-files --write
npm test
```

The focused provenance tests compare every canonical cell, edge, source-file pin, and contact total with `lib/mdn-banc.ts`. They also derive the left, right, and bilateral selections from the artifact and compare them with `lib/fly-brain.ts`. This creates a checked chain from the pinned raw release to the data used by the viewer.
