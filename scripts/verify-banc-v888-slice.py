#!/usr/bin/env python3
"""Extract and verify FlyLab's canonical BANC v888 MDN/LBL40 slice."""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARTIFACT = REPOSITORY_ROOT / "data" / "banc-v888-mdn-lbl40-slice.json"

SOURCE_FILES: tuple[dict[str, Any], ...] = (
    {
        "name": "banc_888_meta.feather",
        "dataverse_datafile_id": "14033740",
        "md5": "6275eda42f98c49539d1ab513d979d09",
        "sha256": "819bbcff476e52702d6f8d8604ce1f12d1d7b11942281df2f49df2a73a6f15a5",
        "bytes": 57_550_610,
        "raw_rows": 188_508,
        "role": "Per-neuron annotations and pinned cross-dataset matches.",
    },
    {
        "name": "banc_888_edgelist_simple_v3.feather",
        "dataverse_datafile_id": "13918810",
        "md5": "08542b0771db7418ed474be60dc9886c",
        "sha256": "8c296e946f3c69a8c7222f30ad75fa8a98eeb189124fec6df829c9125f4be64b",
        "bytes": 359_161_658,
        "raw_rows": 13_620_865,
        "role": "Directed neuron-to-neuron edge list rolled up from the v3 synapse set.",
    },
)

CELL_COLUMNS = (
    "banc_888_id",
    "root_id",
    "nucleus_id",
    "side",
    "proofread",
    "roughly_proofread",
    "status",
    "cell_type",
    "manc_cell_type",
    "malecns_cell_type",
    "fanc_cell_type",
    "fafb_match",
    "manc_match",
    "malecns_match",
    "neurotransmitter_predicted",
    "neurotransmitter_score",
    "neurotransmitter_verified",
    "root_region",
    "region",
    "flow",
    "super_class",
    "cell_class",
)
EDGE_COLUMNS = ("pre", "post", "count", "norm", "post_count", "pre_count")
EXPECTED_CELL_IDS = (
    "720575941491012809",
    "720575941491065653",
    "720575941499708745",
    "720575941614906387",
    "720575941669107187",
    "720575941669069043",
)
EXPECTED_EDGES = (
    ("720575941491012809", "720575941669069043", 52),
    ("720575941491065653", "720575941669069043", 51),
    ("720575941499708745", "720575941669107187", 26),
    ("720575941614906387", "720575941669107187", 24),
)
EXPECTED_CONTACT_TOTAL = 153


class VerificationError(RuntimeError):
    """Raised when a pinned-source or canonical-artifact invariant fails."""


def file_digests(path: Path) -> tuple[int, str, str]:
    md5 = hashlib.md5(usedforsecurity=False)
    sha256 = hashlib.sha256()
    size = 0
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            size += len(chunk)
            md5.update(chunk)
            sha256.update(chunk)
    return size, md5.hexdigest(), sha256.hexdigest()


def verify_source_files(source_directory: Path) -> dict[str, Path]:
    paths: dict[str, Path] = {}
    for expected in SOURCE_FILES:
        path = source_directory / expected["name"]
        if not path.is_file():
            raise VerificationError(f"Missing pinned source file: {path}")
        size, md5, sha256 = file_digests(path)
        observed = {"bytes": size, "md5": md5, "sha256": sha256}
        for field, value in observed.items():
            if value != expected[field]:
                raise VerificationError(
                    f"{expected['name']} {field} mismatch: expected "
                    f"{expected[field]!r}, observed {value!r}"
                )
        paths[expected["name"]] = path
    return paths


def require_columns(table: Any, expected: tuple[str, ...], source_name: str) -> None:
    missing = sorted(set(expected) - set(table.column_names))
    if missing:
        raise VerificationError(f"{source_name} is missing columns: {', '.join(missing)}")


def parse_arrow_boolean(value: Any, field: str, cell_id: str) -> bool:
    if value == "TRUE":
        return True
    if value == "FALSE":
        return False
    raise VerificationError(f"Unexpected {field} value for {cell_id}: {value!r}")


def normalize_cell(row: dict[str, Any]) -> dict[str, Any]:
    cell_id = row["banc_888_id"]
    normalized = {field: row[field] for field in CELL_COLUMNS}
    normalized["proofread"] = parse_arrow_boolean(row["proofread"], "proofread", cell_id)
    normalized["roughly_proofread"] = parse_arrow_boolean(
        row["roughly_proofread"], "roughly_proofread", cell_id
    )
    normalized["flylab_provenance"] = "derived"
    return normalized


def normalize_edge(row: dict[str, Any]) -> dict[str, Any]:
    normalized = {field: row[field] for field in EDGE_COLUMNS}
    normalized["flylab_provenance"] = "connectome_inferred"
    return normalized


def extract_artifact(paths: dict[str, Path]) -> dict[str, Any]:
    try:
        import pyarrow as pa
        import pyarrow.compute as pc
        import pyarrow.feather as feather
    except ModuleNotFoundError as error:
        raise VerificationError(
            "pyarrow is required; install the documented pyarrow==21.0.0 environment"
        ) from error

    metadata_name = SOURCE_FILES[0]["name"]
    edgelist_name = SOURCE_FILES[1]["name"]
    metadata = feather.read_table(paths[metadata_name], columns=CELL_COLUMNS, memory_map=True)
    require_columns(metadata, CELL_COLUMNS, metadata_name)
    if metadata.num_rows != SOURCE_FILES[0]["raw_rows"]:
        raise VerificationError(
            f"{metadata_name} row-count mismatch: expected {SOURCE_FILES[0]['raw_rows']}, "
            f"observed {metadata.num_rows}"
        )

    cell_type_values = pa.array(["MDN", "LBL40"], type=pa.string())
    selected_metadata = metadata.filter(
        pc.is_in(metadata["cell_type"], value_set=cell_type_values)
    )
    cells = [normalize_cell(row) for row in selected_metadata.to_pylist()]
    cell_type_order = {"MDN": 0, "LBL40": 1}
    side_order = {"left": 0, "right": 1}
    cells.sort(
        key=lambda cell: (
            cell_type_order.get(cell["cell_type"], 99),
            side_order.get(cell["side"], 99),
            cell["banc_888_id"],
        )
    )

    observed_ids = tuple(cell["banc_888_id"] for cell in cells)
    if observed_ids != EXPECTED_CELL_IDS:
        raise VerificationError(
            f"Expected the six pinned MDN/LBL40 IDs {EXPECTED_CELL_IDS!r}, "
            f"observed {observed_ids!r}"
        )
    if sum(cell["cell_type"] == "MDN" for cell in cells) != 4:
        raise VerificationError("The pinned slice must contain exactly four MDN rows")
    if sum(cell["cell_type"] == "LBL40" for cell in cells) != 2:
        raise VerificationError("The pinned slice must contain exactly two LBL40 rows")
    if not all(cell["proofread"] and not cell["roughly_proofread"] for cell in cells):
        raise VerificationError("All six pinned cells must be proofread and not roughly_proofread")

    edgelist = feather.read_table(paths[edgelist_name], columns=EDGE_COLUMNS, memory_map=True)
    require_columns(edgelist, EDGE_COLUMNS, edgelist_name)
    if edgelist.num_rows != SOURCE_FILES[1]["raw_rows"]:
        raise VerificationError(
            f"{edgelist_name} row-count mismatch: expected {SOURCE_FILES[1]['raw_rows']}, "
            f"observed {edgelist.num_rows}"
        )

    mdn_ids = pa.array(
        [cell["banc_888_id"] for cell in cells if cell["cell_type"] == "MDN"],
        type=pa.string(),
    )
    lbl40_ids = pa.array(
        [cell["banc_888_id"] for cell in cells if cell["cell_type"] == "LBL40"],
        type=pa.string(),
    )
    selected_edges = edgelist.filter(
        pc.and_(
            pc.is_in(edgelist["pre"], value_set=mdn_ids),
            pc.is_in(edgelist["post"], value_set=lbl40_ids),
        )
    )
    edges = [normalize_edge(row) for row in selected_edges.to_pylist()]
    edges.sort(key=lambda edge: (edge["pre"], edge["post"]))

    observed_edges = tuple((edge["pre"], edge["post"], edge["count"]) for edge in edges)
    if observed_edges != EXPECTED_EDGES:
        raise VerificationError(
            f"Expected the four pinned directed edges {EXPECTED_EDGES!r}, "
            f"observed {observed_edges!r}"
        )
    total_contacts = sum(edge["count"] for edge in edges)
    if total_contacts != EXPECTED_CONTACT_TOTAL:
        raise VerificationError(
            f"Expected {EXPECTED_CONTACT_TOTAL} contacts, observed {total_contacts}"
        )

    return {
        "schema": "flylab.banc-v888-mdn-lbl40-slice.v1",
        "snapshot": "banc_888",
        "selection": {
            "cells": "cell_type is MDN or LBL40",
            "edges": "pre is an extracted MDN and post is an extracted LBL40",
            "cell_sort": "cell_type (MDN, LBL40), side (left, right), banc_888_id",
            "edge_sort": "pre, post",
        },
        "source_files": list(SOURCE_FILES),
        "cells": cells,
        "edges": edges,
        "total_contacts": total_contacts,
    }


def canonical_json(artifact: dict[str, Any]) -> str:
    return json.dumps(artifact, ensure_ascii=False, indent=2, allow_nan=False) + "\n"


def write_or_check_artifact(artifact: dict[str, Any], path: Path, write: bool) -> None:
    observed = canonical_json(artifact)
    if write:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(observed, encoding="utf-8")
        print(f"Wrote canonical BANC slice: {path}")
        return

    if not path.is_file():
        raise VerificationError(f"Canonical artifact is missing: {path}")
    expected = path.read_text(encoding="utf-8")
    if observed != expected:
        diff = "".join(
            difflib.unified_diff(
                expected.splitlines(keepends=True),
                observed.splitlines(keepends=True),
                fromfile=str(path),
                tofile="fresh extraction",
            )
        )
        raise VerificationError(f"Canonical artifact does not match the pinned sources:\n{diff}")
    print(
        "Verified pinned BANC v888 sources and canonical slice: "
        "6 neurons, 4 directed edges, 153 contacts"
    )


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Verify the pinned BANC v888 Feather files and reproduce FlyLab's "
            "six-neuron/four-edge MDN-to-LBL40 slice."
        )
    )
    parser.add_argument(
        "source_directory",
        type=Path,
        help="directory containing the two pinned BANC v888 Feather files",
    )
    parser.add_argument(
        "--artifact",
        type=Path,
        default=DEFAULT_ARTIFACT,
        help=f"canonical artifact path (default: {DEFAULT_ARTIFACT})",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="write the extracted canonical artifact instead of checking it",
    )
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    try:
        paths = verify_source_files(arguments.source_directory.resolve())
        artifact = extract_artifact(paths)
        write_or_check_artifact(artifact, arguments.artifact.resolve(), arguments.write)
    except VerificationError as error:
        print(f"BANC slice verification failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
