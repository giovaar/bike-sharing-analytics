"""Build the historical explorer from a verified Phase 2A evaluation."""
import argparse
from collections import defaultdict
import csv
from datetime import date, datetime
from hashlib import file_digest
import json
from math import isclose, isfinite, sqrt
from pathlib import Path
from statistics import mean, fmean

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/raw/bike-sharing/hour.csv"
OUTPUT = ROOT / "web/public/data/historical-scenarios.csv"


def read_csv(path):
    with path.open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def prepare(prediction_path, metrics_path):
    metadata = json.loads(metrics_path.read_text(encoding="utf-8"))
    with DATA.open("rb") as source:
        if file_digest(source, "sha256").hexdigest() != metadata["source_sha256"]:
            raise ValueError("Canonical data fingerprint differs")
    start = date.fromisoformat(metadata["test_start_inclusive"][:10])
    end = date.fromisoformat(metadata["test_end_exclusive"][:10])
    if (start.isoformat(), end.isoformat()) != ("2012-10-01", "2013-01-01"):
        raise ValueError("Unexpected Phase 2A test dates")
    train = defaultdict(list)
    test = {}
    for row in read_csv(DATA):
        day = date.fromisoformat(row["dteday"])
        group = (row["hr"], row["workingday"])
        actual = int(row["cnt"])
        if day < start:
            train[group].append(actual)
        elif day < end:
            test[(row["dteday"], int(row["hr"]))] = actual, group
    averages = {key: mean(values) for key, values in train.items()}
    results = []
    seen = set()
    for row in read_csv(prediction_path):
        time = datetime.fromisoformat(row["timestamp"])
        key = (time.date().isoformat(), time.hour)
        if time.tzinfo or time.minute or time.second or time.microsecond or key in seen or key not in test:
            raise ValueError("Unexpected or duplicate scenario timestamp")
        actual, group = test[key]
        forest = float(row["random_forest"])
        reference = float(row["hour_workingday_mean"])
        if int(row["cnt"]) != actual or not isfinite(forest) or forest < 0 or not isclose(reference, averages[group]):
            raise ValueError(f"Scenario differs from source at {key}")
        seen.add(key)
        results.append((*key, actual, forest, reference))
    if seen != set(test) or len(results) != metadata["test"]["records"] or len(results) != 2168:
        raise ValueError("Incomplete scenario coverage")
    target_mean = fmean(row[2] for row in results)
    variance = fmean((row[2] - target_mean) ** 2 for row in results)
    for column, name in ((3, "random_forest"), (4, "hour_workingday_mean")):
        errors = [abs(row[column] - row[2]) for row in results]
        mse = fmean(error**2 for error in errors)
        values = {"r2": 1 - mse / variance, "mae": fmean(errors), "rmse": sqrt(mse)}
        if any(not isclose(value, metadata["metrics"][name][key], rel_tol=1e-12)
               for key, value in values.items()):
            raise ValueError(f"Scores differ from Phase 2A for {name}")
    return sorted(results)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--metrics", type=Path, required=True)
    parser.add_argument("--check", action="store_true", help="Compare with the existing output instead of writing")
    args = parser.parse_args()
    results = prepare(args.predictions, args.metrics)
    from io import StringIO

    data = StringIO(newline="")
    writer = csv.writer(data, lineterminator="\n")
    writer.writerow(("date", "hour", "actual", "randomForest", "reference"))
    writer.writerows(results)
    content = data.getvalue().encode("utf-8")
    if args.check:
        if OUTPUT.read_bytes() != content:
            raise SystemExit("The explorer export differs")
    else:
        with OUTPUT.open("xb") as target:
            target.write(content)
    print(f"Verified {len(results)} Phase 2A scenarios ({len(content)} bytes).")


if __name__ == "__main__":
    main()
