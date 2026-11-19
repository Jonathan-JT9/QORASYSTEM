"""Evaluate a QORA checkpoint on an independently labeled CXR directory."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import UnidentifiedImageError

from model_loader import load_model, pil_from_bytes, predict_image

CLASS_DIRECTORIES = {
    "normal": 0,
    "tb": 1,
    "tuberculosis": 1,
}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff"}


def load_labeled_images(dataset_dir: Path) -> list[tuple[Path, int]]:
    samples = []
    for class_dir in sorted(path for path in dataset_dir.iterdir() if path.is_dir()):
        label = CLASS_DIRECTORIES.get(class_dir.name.casefold())
        if label is None:
            continue
        for image_path in sorted(class_dir.rglob("*")):
            if image_path.is_file() and image_path.suffix.casefold() in IMAGE_EXTENSIONS:
                samples.append((image_path, label))

    if not samples:
        raise ValueError(
            "Dataset kosong. Gunakan subfolder Normal/ dan TB/ "
            "(atau Tuberculosis/) yang berisi citra."
        )
    labels = {label for _, label in samples}
    if labels != {0, 1}:
        raise ValueError("Dataset evaluasi harus memuat citra Normal dan TB.")
    return samples


def binary_auc(labels: list[int], scores: list[float]) -> float | None:
    positives = sum(labels)
    negatives = len(labels) - positives
    if not positives or not negatives:
        return None

    order = sorted(range(len(scores)), key=scores.__getitem__)
    rank_sum = 0.0
    start = 0
    while start < len(order):
        end = start + 1
        while end < len(order) and scores[order[end]] == scores[order[start]]:
            end += 1
        average_rank = (start + 1 + end) / 2
        rank_sum += sum(
            average_rank for index in order[start:end] if labels[index] == 1
        )
        start = end

    return (rank_sum - positives * (positives + 1) / 2) / (
        positives * negatives
    )


def calculate_metrics(
    labels: list[int],
    scores: list[float],
    threshold: float,
    calibration_bins: int = 10,
) -> dict:
    predictions = [int(score >= threshold) for score in scores]
    true_negative = sum(y == 0 and p == 0 for y, p in zip(labels, predictions))
    false_positive = sum(y == 0 and p == 1 for y, p in zip(labels, predictions))
    false_negative = sum(y == 1 and p == 0 for y, p in zip(labels, predictions))
    true_positive = sum(y == 1 and p == 1 for y, p in zip(labels, predictions))
    count = len(labels)

    def ratio(numerator: int, denominator: int) -> float | None:
        return numerator / denominator if denominator else None

    sensitivity = ratio(true_positive, true_positive + false_negative)
    specificity = ratio(true_negative, true_negative + false_positive)
    precision = ratio(true_positive, true_positive + false_positive)
    f1 = (
        2 * precision * sensitivity / (precision + sensitivity)
        if precision is not None
        and sensitivity is not None
        and precision + sensitivity
        else None
    )

    brier_score = sum(
        (score - label) ** 2 for label, score in zip(labels, scores)
    ) / count
    ece = 0.0
    for bin_index in range(calibration_bins):
        lower = bin_index / calibration_bins
        upper = (bin_index + 1) / calibration_bins
        indexes = [
            i
            for i, score in enumerate(scores)
            if lower <= score < upper
            or (bin_index == calibration_bins - 1 and score == 1)
        ]
        if indexes:
            mean_score = sum(scores[i] for i in indexes) / len(indexes)
            observed_rate = sum(labels[i] for i in indexes) / len(indexes)
            ece += len(indexes) / count * abs(mean_score - observed_rate)

    return {
        "threshold": threshold,
        "confusion_matrix": {
            "true_normal": true_negative,
            "normal_predicted_tb": false_positive,
            "tb_predicted_normal": false_negative,
            "true_tb": true_positive,
        },
        "accuracy": (true_positive + true_negative) / count,
        "sensitivity_tb": sensitivity,
        "specificity_normal": specificity,
        "precision_tb": precision,
        "f1_tb": f1,
        "roc_auc_tb": binary_auc(labels, scores),
        "brier_score_tb": brier_score,
        "expected_calibration_error_10_bins": ece,
    }


def evaluate(dataset_dir: Path, checkpoint: Path, device: str) -> dict:
    samples = load_labeled_images(dataset_dir)
    bundle = load_model(checkpoint, device_preference=device)
    labels = []
    scores = []
    failures = []

    for image_path, label in samples:
        try:
            image = pil_from_bytes(image_path.read_bytes())
            image.load()
            if image.width < 128 or image.height < 128:
                raise ValueError("Resolusi gambar di bawah 128x128.")
            result = predict_image(bundle, image)
            labels.append(label)
            scores.append(float(result["probabilities"]["TB"]))
        except (OSError, ValueError, UnidentifiedImageError) as exc:
            failures.append({"file": str(image_path), "error": str(exc)})

    if not labels:
        raise ValueError("Tidak ada citra valid yang dapat dievaluasi.")

    return {
        "dataset": str(dataset_dir),
        "checkpoint": str(checkpoint),
        "samples_total": len(samples),
        "samples_evaluated": len(labels),
        "class_counts": {
            "normal": sum(label == 0 for label in labels),
            "tb": sum(label == 1 for label in labels),
        },
        "checkpoint_threshold": bundle.threshold,
        "metrics": calculate_metrics(labels, scores, bundle.threshold),
        "failures": failures,
        "limitations": [
            "Results apply only to this labeled dataset and its image sources.",
            "Use patient/source-independent data not used for training or threshold selection.",
            "The classifier is evaluated directly; Gemini/CLIP image checks are not run.",
            "Calibration metrics are descriptive and depend on dataset size and prevalence.",
            "This evaluation is not clinical validation or a guarantee for arbitrary internet images.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset",
        type=Path,
        required=True,
        help="Dataset with Normal/ and TB/ (or Tuberculosis/) subdirectories.",
    )
    parser.add_argument(
        "--checkpoint",
        type=Path,
        default=Path(__file__).parent / "checkpoints" / "best.pt",
    )
    parser.add_argument("--device", default="auto", choices=("auto", "cpu", "cuda"))
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional path for saving the JSON report; defaults to stdout.",
    )
    args = parser.parse_args()

    report = evaluate(args.dataset, args.checkpoint, args.device)
    rendered = json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
        print(f"Evaluation report saved to {args.output}")
    else:
        print(rendered)


if __name__ == "__main__":
    main()
