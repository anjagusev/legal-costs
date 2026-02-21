#!/usr/bin/env python3

import json
import os
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timedelta, timezone


NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


EXCEL_EPOCH = datetime(1899, 12, 30, tzinfo=timezone.utc)


def excel_serial_to_date(serial):
	# Windows Excel 1900 date system; using 1899-12-30 matches common conversions.
	return (EXCEL_EPOCH + timedelta(days=float(serial))).date()


def cell_value(c):
	cell_type = c.attrib.get("t")
	if cell_type == "inlineStr":
		t_el = c.find("m:is/m:t", NS)
		return t_el.text if t_el is not None else ""
	v_el = c.find("m:v", NS)
	return v_el.text if v_el is not None else None


def round2(n):
	return round(float(n) + 1e-12, 2)


def month_key(d):
	return f"{d.year:04d}-{d.month:02d}"


def normalize_amount(v):
	if v is None:
		return None
	try:
		return float(v)
	except Exception:
		return None


def categorize(sent_to):
	s = str(sent_to or "").lower()
	if "(lawyer)" in s:
		return "Legal counsel"
	if "(mediator)" in s:
		return "Mediation"
	if "mediator" in s or "mediation" in s:
		return "Mediation"
	if "law" in s or "lawyer" in s or "counsel" in s or "solicitor" in s:
		return "Legal counsel"
	return "Other professional fees"


def read_sheet_rows(xlsx_path):
	with zipfile.ZipFile(xlsx_path) as z:
		sheet_xml = z.read("xl/worksheets/sheet1.xml")
	root = ET.fromstring(sheet_xml)
	rows = root.findall(".//m:sheetData/m:row", NS)
	if not rows:
		return []

	# Expect headers in row 1: Date, Amount ($), Sent To
	out = []
	for r in rows[1:]:
		cells = {}
		for c in r.findall("m:c", NS):
			ref = c.attrib.get("r") or ""
			col = ""
			for ch in ref:
				if "A" <= ch <= "Z":
					col += ch
				else:
					break
			if not col:
				continue
			cells[col] = cell_value(c)

		date_raw = cells.get("A")
		amt_raw = cells.get("B")
		sent_to = cells.get("C") or ""
		if date_raw is None or amt_raw is None:
			continue
		try:
			d = excel_serial_to_date(date_raw)
		except Exception:
			continue
		amt = normalize_amount(amt_raw)
		if amt is None or amt <= 0:
			continue
		out.append((d, amt, sent_to))

	return out


def main():
	repo_root = os.path.abspath(os.path.join(os.getcwd(), ".."))
	input_path = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(repo_root, "Legal_Etransfer_Payments.xlsx")
	out_path = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(os.getcwd(), "src", "data", "legal-costs.public.json")

	rows = read_sheet_rows(input_path)
	rows.sort(key=lambda x: x[0])

	latest = rows[-1][0] if rows else None
	grand_total = 0.0
	category_totals = defaultdict(float)
	monthly_totals = defaultdict(float)
	monthly_by_cat = defaultdict(lambda: defaultdict(float))

	for d, amt, sent_to in rows:
		cat = categorize(sent_to)
		m = month_key(d)
		grand_total += amt
		category_totals[cat] += amt
		monthly_totals[m] += amt
		monthly_by_cat[m][cat] += amt

	months_sorted = sorted(monthly_totals.keys())
	running = 0.0
	monthly_out = []
	for m in months_sorted:
		running += monthly_totals[m]
		by_cat = dict(sorted(((k, round2(v)) for k, v in monthly_by_cat[m].items()), key=lambda kv: -kv[1]))
		monthly_out.append({
			"month": m,
			"total": round2(monthly_totals[m]),
			"cumulative": round2(running),
			"byCategory": by_cat,
		})

	by_category_out = dict(sorted(((k, round2(v)) for k, v in category_totals.items()), key=lambda kv: -kv[1]))

	out = {
		"currency": "CAD",
		"generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
		"source": {
			"workbook": os.path.basename(input_path),
			"sheet": "Legal Payments",
		},
		"asOfMonth": month_key(latest) if latest else None,
		"total": round2(grand_total),
		"monthly": monthly_out,
		"byCategory": by_category_out,
		"privacy": {
			"detailLevel": "monthly-aggregates",
			"publicFields": ["month", "total", "cumulative", "byCategory"],
			"excludedFields": ["provider names", "invoice line items", "matter details"],
		},
	}

	os.makedirs(os.path.dirname(out_path), exist_ok=True)
	with open(out_path, "w", encoding="utf-8") as f:
		json.dump(out, f, indent=2)
		f.write("\n")

	print(f"Wrote {out_path}")


if __name__ == "__main__":
	main()
