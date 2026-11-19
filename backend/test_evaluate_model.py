import unittest

from evaluate_model import binary_auc, calculate_metrics


class TestEvaluationMetrics(unittest.TestCase):
    def test_metrics_use_checkpoint_style_threshold_and_binary_scores(self):
        metrics = calculate_metrics(
            labels=[0, 0, 1, 1],
            scores=[0.02, 0.12, 0.10, 0.90],
            threshold=0.0838,
        )

        self.assertEqual(
            metrics["confusion_matrix"],
            {
                "true_normal": 1,
                "normal_predicted_tb": 1,
                "tb_predicted_normal": 0,
                "true_tb": 2,
            },
        )
        self.assertEqual(metrics["sensitivity_tb"], 1.0)
        self.assertEqual(metrics["specificity_normal"], 0.5)
        self.assertEqual(metrics["accuracy"], 0.75)
        self.assertEqual(metrics["roc_auc_tb"], 0.75)

    def test_auc_handles_tied_scores(self):
        self.assertEqual(binary_auc([0, 1], [0.5, 0.5]), 0.5)

    def test_auc_is_undefined_if_dataset_has_one_class(self):
        self.assertIsNone(binary_auc([1, 1], [0.3, 0.7]))

    def test_metrics_report_undefined_rates_for_missing_classes(self):
        metrics = calculate_metrics(labels=[1, 1], scores=[0.2, 0.8], threshold=0.5)

        self.assertIsNone(metrics["specificity_normal"])
        self.assertIsNone(metrics["roc_auc_tb"])


if __name__ == "__main__":
    unittest.main()
