#!/usr/bin/env python3
"""Sanitized, read-only structural profiler for local PTO documents.

The profiler never writes to source documents and never stores cell contents.
It records relative identity, SHA-256, workbook/sheet dimensions, merge/formula
counts, and CSV/Office container metadata for regression planning.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import subprocess
import zipfile
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET

NS_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
NS_PKG_REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"


def sha256_path(path: Path) -> str:
    h = hashlib.sha256()
    if path.is_file():
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                h.update(chunk)
    else:
        for child in sorted(p for p in path.rglob("*") if p.is_file()):
            h.update(child.relative_to(path).as_posix().encode())
            with child.open("rb") as fh:
                for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                    h.update(chunk)
    return h.hexdigest()


def tracked_paths(repo: Path) -> list[Path]:
    raw = subprocess.check_output(
        ["git", "-C", str(repo), "ls-files"], text=True, encoding="utf-8", errors="replace"
    )
    paths: list[Path] = []
    wanted = {".xls", ".xlsx", ".xlsm", ".csv", ".pdf", ".docx", ".doc", ".ods", ".f2"}
    for line in raw.splitlines():
        rel = Path(line)
        if rel.suffix.lower() in wanted:
            candidate = repo / rel
            if candidate.exists():
                paths.append(candidate)
    # Unpacked Office fixtures have XML files below a directory whose name ends
    # in .xlsx. Include each workbook root once, without collecting raw values.
    for candidate in repo.joinpath("_f2lab", "_unz").glob("*.xlsx"):
        if candidate.is_dir() and (candidate / "xl" / "workbook.xml").exists():
            if candidate not in paths:
                paths.append(candidate)
    return sorted(paths, key=lambda p: p.relative_to(repo).as_posix().lower())


def xml_bytes(source: zipfile.ZipFile | Path, name: str) -> bytes | None:
    try:
        if isinstance(source, zipfile.ZipFile):
            return source.read(name)
        candidate = source / name
        return candidate.read_bytes() if candidate.exists() else None
    except (OSError, KeyError, zipfile.BadZipFile):
        return None


def parse_xml(source: zipfile.ZipFile | Path, name: str) -> ET.Element | None:
    payload = xml_bytes(source, name)
    if not payload:
        return None
    try:
        return ET.fromstring(payload)
    except ET.ParseError:
        return None


def workbook_profile(path: Path) -> dict:
    source: zipfile.ZipFile | Path
    opened = None
    try:
        if path.is_file():
            opened = zipfile.ZipFile(path)
            source = opened
        else:
            source = path
        workbook = parse_xml(source, "xl/workbook.xml")
        rels = parse_xml(source, "xl/_rels/workbook.xml.rels")
        rel_map: dict[str, str] = {}
        if rels is not None:
            for rel in rels:
                rid = rel.attrib.get("Id")
                target = rel.attrib.get("Target", "")
                if rid:
                    rel_map[rid] = target.replace("\\", "/").lstrip("/")
        sheets: list[dict] = []
        if workbook is not None:
            sheet_root = workbook.find(f"{NS_MAIN}sheets")
            for sheet in list(sheet_root or []):
                name = sheet.attrib.get("name", "")
                rid = sheet.attrib.get(f"{NS_REL}id", "")
                target = rel_map.get(rid, "")
                if target and not target.startswith("xl/"):
                    target = f"xl/{target.lstrip('/')}"
                sheet_xml = parse_xml(source, target) if target else None
                dimension = ""
                rows = cells = formulas = merged = 0
                if sheet_xml is not None:
                    dim = sheet_xml.find(f"{NS_MAIN}dimension")
                    dimension = dim.attrib.get("ref", "") if dim is not None else ""
                    rows = len(sheet_xml.findall(f".//{NS_MAIN}row"))
                    cells = len(sheet_xml.findall(f".//{NS_MAIN}c"))
                    formulas = len(sheet_xml.findall(f".//{NS_MAIN}f"))
                    merged = len(sheet_xml.findall(f".//{NS_MAIN}mergeCell"))
                sheets.append({
                    "name": name,
                    "dimension": dimension,
                    "rows": rows,
                    "cells": cells,
                    "formula_count": formulas,
                    "merged_range_count": merged,
                })
        return {"kind": "xlsx", "sheets": sheets, "sheet_count": len(sheets)}
    finally:
        if opened is not None:
            opened.close()


def docx_profile(path: Path) -> dict:
    try:
        with zipfile.ZipFile(path) as zf:
            payload = zf.read("word/document.xml")
        root = ET.fromstring(payload)
        paragraphs = len(root.findall(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"))
        tables = len(root.findall(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tbl"))
        return {"kind": "docx", "paragraph_count": paragraphs, "table_count": tables}
    except (OSError, KeyError, zipfile.BadZipFile, ET.ParseError):
        return {"kind": "docx", "parse_status": "partial"}


def csv_profile(path: Path) -> dict:
    try:
        with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as fh:
            reader = csv.reader(fh)
            first = next(reader, [])
            rows = 1 if first else 0
            max_columns = len(first)
            for row in reader:
                rows += 1
                max_columns = max(max_columns, len(row))
        return {"kind": "csv", "rows": rows, "max_columns": max_columns}
    except OSError:
        return {"kind": "csv", "parse_status": "partial"}


def pdf_profile(path: Path) -> dict:
    try:
        payload = path.read_bytes()
        return {
            "kind": "pdf",
            "bytes": len(payload),
            "page_marker_count": len(re.findall(rb"/Type\\s*/Page(?:\\s|/|>)", payload)),
        }
    except OSError:
        return {"kind": "pdf", "parse_status": "partial"}


def profile(path: Path, repo: Path) -> dict:
    rel = path.relative_to(repo).as_posix()
    suffix = path.suffix.lower()
    item = {"path": rel, "sha256": sha256_path(path), "is_directory_container": path.is_dir()}
    if suffix in {".xlsx", ".xlsm"} and (path.is_dir() or zipfile.is_zipfile(path)):
        item.update(workbook_profile(path))
    elif suffix == ".docx":
        item.update(docx_profile(path))
    elif suffix == ".csv":
        item.update(csv_profile(path))
    elif suffix == ".pdf":
        item.update(pdf_profile(path))
    else:
        item.update({"kind": suffix.lstrip(".") or "unknown", "bytes": path.stat().st_size if path.is_file() else None})
    return item


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    repo = args.repo.resolve()
    records = [profile(p, repo) for p in tracked_paths(repo)]
    by_kind: dict[str, int] = {}
    for record in records:
        by_kind[record["kind"]] = by_kind.get(record["kind"], 0) + 1
    result = {
        "schema": "pto-document-profile-v1",
        "read_only": True,
        "raw_cell_values_stored": False,
        "record_count": len(records),
        "kind_counts": by_kind,
        "records": records,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"record_count": len(records), "kind_counts": by_kind, "out": str(args.out)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
