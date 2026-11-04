#!/usr/bin/env python3
"""Rebuild src/lib/practise/master-lists.json from Kidda_Level_Master_Lists.xlsx.
Usage: python3 scripts/practise/import-master-lists.py path/to/workbook.xlsx
Ids hash the level, kind and text, so progress survives reordering rows."""
import hashlib, json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
def rows(n): return list(wb[n].iter_rows(values_only=True))[1:]
def s(v): return str(v).strip() if v is not None else ""
items, seen = [], set()
def add(level, kind, topic, en, gu, ro, gender="", drafted=False):
    key = f"{level}|{kind}|{gu}|{ro}|{en}"
    if key in seen: return
    seen.add(key)
    it = dict(id=hashlib.sha1(key.encode()).hexdigest()[:12], l=level, k=kind, t=topic, e=en, g=gu, r=ro)
    if gender: it["x"] = gender
    if drafted: it["d"] = 1
    items.append(it)
for r in rows("Words"):
    add(r[0], "w", s(r[1]), s(r[2]), s(r[3]), s(r[4]), s(r[5]), "Drafted" in s(r[7]))
for r in rows("Sentences"):
    add(r[0], "s", s(r[1]), s(r[4]), s(r[2]), s(r[3]), "", "Drafted" in s(r[5]))
for r in rows("Sounds"):
    add(r[0], {"Sound map": "m", "Sound pair": "p", "Vowel": "v"}[s(r[5])], s(r[1]), s(r[4]), s(r[2]), s(r[3]))
for r in rows("Grammar"):
    if r[0] in (0, 9): continue
    add(r[0], "r", s(r[2]), s(r[1]), "", "")
json.dump(items, open("src/lib/practise/master-lists.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(items))
