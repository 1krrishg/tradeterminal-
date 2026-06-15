#!/usr/bin/env python3
"""
Upload 29 years of USITC HTS data to Supabase.
Run: python3 scripts/upload-hts-data.py
"""

import csv
import os
import json
import time
import math
import urllib.request
import urllib.error
from collections import defaultdict

SUPABASE_URL = "https://qszregcopfbiavgwvfip.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenJlZ2NvcGZiaWF2Z3d2ZmlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDM2MjgwNiwiZXhwIjoyMDk1OTM4ODA2fQ.4jcUlM6cz2u2nwyJacSmPcKrInhVy2U9LW1dc9VXSSc"
DATA_BASE = "/Users/1krrishgoel/Downloads/Tariff Data"

FILES = {
    1998: "tariff_data_1998/tariff_database_1998.txt",
    1999: "tariff_data_1999/tariff_database_1999.txt",
    2000: "tariff_data_2000/tariff_database_2000.txt",
    2001: "tariff_data_2001/tariff_database_2001.txt",
    2002: "tariff_data_2002/tariff_database_2002.txt",
    2003: "tariff_data_2003/tariff_database_2003.txt",
    2004: "tariff_data_2004/tariff_database_2004.txt",
    2005: "tariff_data_2005/tariff_database_2005.txt",
    2006: "tariff_data_2006/tariff_database_2006.txt",
    2007: "tariff_data_2007/tariff_database_2007.txt",
    2008: "tariff_data_2008/tariff_database_2008.txt",
    2009: "tariff_data_2009/tariff_database_2009.txt",
    2010: "tariff_data_2010/tariff_database_2010.txt",
    2011: "tariff_data_2011/tariff_database_2011.txt",
    2012: "tariff_data_2012/tariff_database_2012.txt",
    2013: "tariff_data_2013/tariff_database_2013.txt",
    2014: "tariff_data_2014/tariff_database_2014.txt",
    2015: "tariff_data_2015/tariff_database_2015.txt",
    2016: "tariff_data_2016/tariff_database_2016.txt",
    2017: "tariff_data_2017/tariff_database_2017.txt",
    2018: "tariff_data_2018/tariff_database_2018.txt",
    2019: "tariff_data_2019/trade_tariff_database_201811.txt",
    2020: "tariff_data_2020/tariff_database_text_version_202010.txt",
    2021: "tariff_data_2021/tariff_database_text_version_202106.txt",
    2022: "tariff_data_2022/tariff_database_text_version_202207.txt",
    2023: "tariff_data_2023/trade_tariff_database_202307.txt",
    2024: "tariff_data_2024/trade_tariff_database_202405.txt",
    2025: "tariff_data_2025/tariff_database_2025.txt",
    2026: "tariff_data_2026/tariff_database_2026.txt",
}


def upsert(table, rows, on_conflict=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    data = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"\n  HTTP {e.code}: {body[:300]}")
        return e.code


def dedup(rows, key_fn):
    """Remove duplicates within a list, keeping last occurrence."""
    seen = {}
    for row in rows:
        seen[key_fn(row)] = row
    return list(seen.values())


def batch_upsert(table, rows, batch_size=500, on_conflict=None, key_fn=None, label=""):
    # Dedup the full list first
    if key_fn:
        rows = dedup(rows, key_fn)
    total = len(rows)
    errors = 0
    for i in range(0, total, batch_size):
        chunk = rows[i: i + batch_size]
        # Also dedup within each chunk (safety net)
        if key_fn:
            chunk = dedup(chunk, key_fn)
        status = upsert(table, chunk, on_conflict)
        pct = min(100, int((i + len(chunk)) / total * 100))
        print(f"  {label} {pct}% ({i + len(chunk)}/{total})", end="\r")
        if status >= 400:
            errors += 1
            if errors > 5:
                print(f"\n  Too many errors, stopping.")
                return False
        time.sleep(0.03)
    print(f"  {label} 100% ({total} rows) ✓          ")
    return True


def parse_file(year, path):
    rows = []
    with open(path, encoding="latin-1") as f:
        r = csv.reader(f)
        headers = [h.lower().strip() for h in next(r)]

        def col(name):
            try: return headers.index(name)
            except ValueError: return None

        hs_col = col("hts8") or 0
        desc_col = col("brief_description") or 1
        mfn_col = col("mfn_ad_val_rate") or col("mfn_ave")
        col2_col = col("col2_ad_val_rate")

        for row in r:
            if not row or len(row) < 5:
                continue
            hts8 = row[hs_col].strip().strip('"').strip()
            if not hts8 or len(hts8) < 7:
                continue
            desc = row[desc_col].strip().strip('"').strip() if desc_col is not None and len(row) > desc_col else ""
            mfn_rate = 0.0
            if mfn_col is not None and len(row) > mfn_col:
                try: mfn_rate = float(row[mfn_col].strip() or 0)
                except: pass
            col2_rate = 0.0
            if col2_col is not None and len(row) > col2_col:
                try: col2_rate = float(row[col2_col].strip() or 0)
                except: pass
            rows.append((hts8, desc, round(mfn_rate, 6), round(col2_rate, 6)))
    return rows


def compute_volatility(history):
    results = []
    for hts8, yr_rates in history.items():
        rates = [v for v in yr_rates.values() if v is not None]
        if len(rates) < 3:
            continue
        avg = sum(rates) / len(rates)
        mx, mn = max(rates), min(rates)
        stddev = math.sqrt(sum((r - avg) ** 2 for r in rates) / len(rates))
        sorted_years = sorted(yr_rates.keys())
        max_jump, max_jump_year = 0, None
        for i in range(1, len(sorted_years)):
            jump = (yr_rates.get(sorted_years[i], 0) or 0) - (yr_rates.get(sorted_years[i-1], 0) or 0)
            if jump > max_jump:
                max_jump, max_jump_year = jump, sorted_years[i]
        risk = "HIGH" if stddev > 0.05 or max_jump > 0.10 else "MEDIUM" if stddev > 0.02 or max_jump > 0.03 else "LOW"
        results.append({
            "hts8": hts8, "avg_rate": round(avg, 6), "max_rate": round(mx, 6),
            "min_rate": round(mn, 6), "volatility": round(stddev, 6),
            "max_year_jump": round(max_jump, 6), "max_jump_year": max_jump_year,
            "risk_label": risk,
        })
    return results


def main():
    print("=" * 60)
    print("TariffLens HTS Data Upload")
    print("=" * 60)

    print("\n[1/4] Parsing all 29 year files...")
    catalog_2026 = []
    rate_history_rows = []
    history_by_hts = defaultdict(dict)

    for year in sorted(FILES.keys()):
        path = os.path.join(DATA_BASE, FILES[year])
        rows = parse_file(year, path)
        print(f"  {year}: {len(rows)} rows")
        for hts8, desc, mfn, col2 in rows:
            history_by_hts[hts8][year] = mfn
            rate_history_rows.append({"hts8": hts8, "year": year, "mfn_rate": mfn, "col2_rate": col2})
            if year == 2026:
                catalog_2026.append({"hts8": hts8, "description": desc, "mfn_rate": mfn, "col2_rate": col2, "updated_year": 2026})

    print(f"\n  {len(rate_history_rows)} history rows, {len(catalog_2026)} catalog rows")

    print("\n[2/4] Uploading hts_catalog (12k rows)...")
    batch_upsert("hts_catalog", catalog_2026, batch_size=200, on_conflict="hts8",
                 key_fn=lambda r: r["hts8"], label="catalog")

    print("\n[3/4] Uploading rate_history (313k rows, ~8 min)...")
    batch_upsert("rate_history", rate_history_rows, batch_size=200, on_conflict="hts8%2Cyear",
                 key_fn=lambda r: (r["hts8"], r["year"]), label="history")

    print("\n[4/4] Uploading volatility scores...")
    vol_rows = compute_volatility(history_by_hts)
    print(f"  {len(vol_rows)} records — HIGH:{sum(1 for r in vol_rows if r['risk_label']=='HIGH')}, MED:{sum(1 for r in vol_rows if r['risk_label']=='MEDIUM')}")
    batch_upsert("hts_volatility", vol_rows, batch_size=200, on_conflict="hts8",
                 key_fn=lambda r: r["hts8"], label="volatility")

    print("\n✓ All done. 29 years of HTS data is in Supabase.")


if __name__ == "__main__":
    main()
