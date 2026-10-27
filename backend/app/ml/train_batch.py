"""
Batch Training CLI and Persistent Model Registry Orchestrator.
Decouples on-the-fly model fitting from API inference by training estimators offline
and registering serialized artifacts into data/models/ and DuckDB model_registry.
"""

import argparse
import sys
import time
from pathlib import Path
from typing import List, Optional, Tuple

import polars as pl
from app.core.database import DuckDBManager
from app.ml.feature_pipeline import build_feature_matrix
from app.ml.forecaster import (
    evaluate_backtest,
    save_to_registry,
    train_adaptive_forecaster,
)


def get_available_store_skus(
    store_filter: Optional[List[str]] = None,
    sku_filter: Optional[List[str]] = None,
) -> List[Tuple[str, str]]:
    """Discovers unique store-SKU time series in DuckDB historical_sales."""
    db = DuckDBManager.get_instance()
    with db.cursor() as cur:
        cur.execute("SELECT DISTINCT store_id, sku_id FROM historical_sales ORDER BY store_id, sku_id;")
        pairs = cur.fetchall()

    filtered = []
    for s_id, k_id in pairs:
        if store_filter and s_id not in store_filter:
            continue
        if sku_filter and k_id not in sku_filter:
            continue
        filtered.append((str(s_id), str(k_id)))
    return filtered


def train_single_store_sku(
    store_id: str,
    sku_id: str,
    version: str = "1.0.0",
) -> dict:
    """Trains, backtests, serializes, and registers a single store-SKU pair."""
    start_t = time.perf_counter()
    db = DuckDBManager.get_instance()

    with db.cursor() as cur:
        cur.execute(
            """
            SELECT date, store_id, sku_id, sales, price, discount_pct, promo_active,
                   temperature_celsius, precipitation_mm, extreme_weather_flag, stock_on_hand
            FROM historical_sales
            WHERE store_id = ? AND sku_id = ?
            ORDER BY date ASC;
            """,
            [store_id, sku_id],
        )
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]

    if len(rows) < 30:
        return {
            "status": "SKIPPED",
            "store_id": store_id,
            "sku_id": sku_id,
            "reason": f"Insufficient records ({len(rows)})",
        }

    raw_df = pl.DataFrame(rows, schema=cols, orient="row")
    feature_df = build_feature_matrix(raw_df)

    # 1. Adaptive training (Smooth vs Intermittent)
    model, profile = train_adaptive_forecaster(feature_df, target_col="sales")

    # 2. Chronological out-of-sample backtest
    backtest_res = evaluate_backtest(feature_df, target_col="sales", test_days=30)
    metrics = backtest_res["metrics"]

    elapsed = time.perf_counter() - start_t

    # 3. Serialize and save to registry
    artifact_path = save_to_registry(
        model=model,
        store_id=store_id,
        sku_id=sku_id,
        version=version,
        metrics=metrics,
        model_type=profile.recommended_model,
        training_duration_sec=round(elapsed, 3),
    )

    return {
        "status": "SUCCESS",
        "store_id": store_id,
        "sku_id": sku_id,
        "model_type": profile.recommended_model,
        "demand_category": profile.category,
        "wape_pct": metrics["wape_pct"],
        "bias_pct": metrics["bias_pct"],
        "mase": metrics["mase"],
        "duration_sec": round(elapsed, 2),
        "artifact_path": artifact_path,
    }


def main():
    parser = argparse.ArgumentParser(
        description="DemandSync Batch Training & Model Registry Pipeline"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Train models across all available stores and SKUs in DuckDB",
    )
    parser.add_argument(
        "--stores",
        nargs="+",
        help="List of store IDs to train (e.g. S001 S002)",
    )
    parser.add_argument(
        "--skus",
        nargs="+",
        help="List of SKU IDs to train (e.g. P0001 P0002)",
    )
    parser.add_argument(
        "--version",
        default="1.0.0",
        help="Model artifact version tag (default: 1.0.0)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional maximum number of series to train in this batch run",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("DemandSync: Offline Batch Training & Model Registry")
    print("=" * 70)

    pairs = get_available_store_skus(store_filter=args.stores, sku_filter=args.skus)
    if args.limit:
        pairs = pairs[: args.limit]

    total_pairs = len(pairs)
    print(f"[*] Discovered {total_pairs} store-SKU time series for training.")

    if total_pairs == 0:
        print("[!] No matching store-SKU records found.")
        sys.exit(0)

    success_count = 0
    t0 = time.time()

    for idx, (store_id, sku_id) in enumerate(pairs, 1):
        print(f"[{idx}/{total_pairs}] Training {store_id} / {sku_id} ...", end=" ", flush=True)
        res = train_single_store_sku(store_id, sku_id, version=args.version)
        if res["status"] == "SUCCESS":
            success_count += 1
            print(
                f"[OK] Done in {res['duration_sec']}s | Type: {res['model_type']} | "
                f"WAPE: {res['wape_pct']}% | Bias: {res['bias_pct']}% | MASE: {res['mase']}"
            )
        else:
            print(f"[!] {res['status']}: {res.get('reason')}")

    total_time = round(time.time() - t0, 2)
    print("=" * 70)
    print(f"[SUCCESS] Batch Training Completed: {success_count}/{total_pairs} models registered in {total_time}s")
    print("=" * 70)


if __name__ == "__main__":
    main()
