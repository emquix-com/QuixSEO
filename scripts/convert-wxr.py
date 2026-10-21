#!/usr/bin/env python3
"""Convert WordPress WXR postmeta to explicit QuixSEO migration batches.

No network, database connection, PHP execution, or automatic slug matching.
"""
import argparse
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET

MAX_BYTES = 32 * 1024 * 1024
WP = "{http://wordpress.org/export/1.2/}"


def convert(wxr: Path, mapping: Path, source: str) -> list[dict]:
    if wxr.stat().st_size > MAX_BYTES or mapping.stat().st_size > MAX_BYTES:
        raise ValueError("Input is larger than 32 MiB; split it before conversion")
    data = wxr.read_bytes()
    # Decode first so a UTF-16/32 document cannot hide a declaration behind NULs.
    if b"\x00" in data:
        raise ValueError("Use a UTF-8 WXR export")
    if re.search(br"<!\s*(?:DOCTYPE|ENTITY)\b", data, re.I):
        raise ValueError("DTD and entity declarations are not supported")
    maps = json.loads(mapping.read_text(encoding="utf-8"))
    if not isinstance(maps, list):
        raise ValueError("Mapping must be an array of sourceId, collection, id objects")
    lookup = {}
    targets = set()
    for item in maps:
        if not isinstance(item, dict) or set(item) != {"sourceId", "collection", "id"}:
            raise ValueError("Each mapping needs exactly sourceId, collection, id")
        if not all(isinstance(v, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,128}", v) for v in item.values()):
            raise ValueError("Mapping identifiers must be strings containing letters, digits, underscore or hyphen")
        key = item["sourceId"]
        target = (item["collection"], item["id"])
        if key in lookup or target in targets:
            raise ValueError("Duplicate source or target in mapping")
        lookup[key] = item
        targets.add(target)
    prefix = "_yoast_wpseo_" if source == "yoast" else "rank_math_"
    root = ET.fromstring(data)
    output = []
    matched = set()
    for item in root.findall("./channel/item"):
        source_id = item.findtext(f"{WP}post_id")
        if source_id not in lookup:
            continue
        if source_id in matched:
            raise ValueError("Duplicate WordPress post ID")
        matched.add(source_id)
        meta = {}
        for pair in item.findall(f"{WP}postmeta"):
            key = pair.findtext(f"{WP}meta_key", "")
            if key.startswith(prefix):
                if key in meta:
                    raise ValueError(f"Duplicate metadata key for post {source_id}: {key}")
                meta[key] = pair.findtext(f"{WP}meta_value", "")
        target = lookup[source_id]
        output.append({"source": source, "collection": target["collection"], "id": target["id"], "meta": meta})
    missing = set(lookup) - matched
    if missing:
        raise ValueError("Mapped WordPress IDs were absent from the export: " + ", ".join(sorted(missing)))
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("wxr", type=Path)
    parser.add_argument("mapping", type=Path)
    parser.add_argument("--source", choices=["yoast", "rankmath"], required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    records = convert(args.wxr, args.mapping, args.source)
    # Exclusive creation prevents accidentally overwriting an earlier conversion.
    with args.output.open("x", encoding="utf-8") as out:
        json.dump(records, out, ensure_ascii=False, indent=2)
        out.write("\n")
    print(f"Converted {len(records)} mapped entries. Review and import batches of at most 20 entries / 48 KiB.")


if __name__ == "__main__":
    main()
