"""Automated tests for Gemini Vision + CLIP Validation Pipeline in QORA."""
import io
import json
import unittest
from unittest.mock import MagicMock, patch

from PIL import Image

# Import validator functions
from gemini_service import validate_image_with_gemini
from image_validator import validate_clip, validate_chest_xray


def make_dummy_image(size=(256, 256), color=(128, 128, 128)):
    return Image.new("RGB", size, color=color)


class TestGeminiVisionValidation(unittest.TestCase):
    """Test Stage 1: Gemini Vision validation logic, schema enforcement, and edge cases."""

    @patch("gemini_service.get_client")
    def test_gemini_valid_frontal_cxr_passes(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "is_chest_xray": True,
            "body_part": "chest",
            "projection": "PA",
            "is_grayscale": True,
            "image_quality": "acceptable",
            "scope_assessment": "in_scope",
            "decision": "pass",
            "reason_code": "SUPPORTED_CHEST_XRAY",
            "reason": "Clear frontal PA chest X-ray in grayscale."
        })
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        img = make_dummy_image()
        result = validate_image_with_gemini(img)

        self.assertTrue(result["accepted"])
        self.assertEqual(result["decision"], "pass")
        self.assertEqual(result["reason_code"], "SUPPORTED_CHEST_XRAY")
        self.assertEqual(result["projection"], "PA")
        self.assertTrue(result["is_grayscale"])
        self.assertIn("Melanjutkan klasifikasi", result["message"])

    @patch("gemini_service.get_client")
    def test_gemini_rejects_lateral_projection(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "is_chest_xray": True,
            "body_part": "chest",
            "projection": "lateral",
            "is_grayscale": True,
            "image_quality": "acceptable",
            "scope_assessment": "in_scope",
            "decision": "reject",
            "reason_code": "LATERAL_PROJECTION",
            "reason": "Lateral view chest radiograph."
        })
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        img = make_dummy_image()
        result = validate_image_with_gemini(img)

        self.assertFalse(result["accepted"])
        self.assertEqual(result["decision"], "reject")
        self.assertEqual(result["reason_code"], "LATERAL_PROJECTION")
        self.assertIn("Proyeksi citra tidak didukung", result["message"])

    @patch("gemini_service.get_client")
    def test_gemini_rejects_colorized_xray(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "is_chest_xray": True,
            "body_part": "chest",
            "projection": "PA",
            "is_grayscale": False,
            "image_quality": "acceptable",
            "scope_assessment": "in_scope",
            "decision": "reject",
            "reason_code": "COLORIZED_XRAY",
            "reason": "Artificially colorized heatmap image."
        })
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        img = make_dummy_image()
        result = validate_image_with_gemini(img)

        self.assertFalse(result["accepted"])
        self.assertEqual(result["decision"], "reject")
        self.assertEqual(result["reason_code"], "COLORIZED_XRAY")
        self.assertIn("grayscale", result["message"])

    @patch("gemini_service.get_client")
    def test_gemini_rejects_other_body_part_or_modality(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "is_chest_xray": False,
            "body_part": "knee",
            "projection": "AP",
            "is_grayscale": True,
            "image_quality": "acceptable",
            "scope_assessment": "uncertain",
            "decision": "reject",
            "reason_code": "OTHER_BODY_OR_MODALITY",
            "reason": "X-ray radiograph of human knee joint."
        })
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        img = make_dummy_image()
        result = validate_image_with_gemini(img)

        self.assertFalse(result["accepted"])
        self.assertEqual(result["decision"], "reject")
        self.assertEqual(result["reason_code"], "OTHER_BODY_OR_MODALITY")
        self.assertIn("Jenis citra tidak didukung", result["message"])

    @patch("gemini_service.get_client")
    def test_gemini_rejects_portrait_or_nonmedical(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "is_chest_xray": False,
            "body_part": "face",
            "projection": "unknown",
            "is_grayscale": False,
            "image_quality": "poor",
            "scope_assessment": "uncertain",
            "decision": "reject",
            "reason_code": "NOT_CHEST_XRAY",
            "reason": "Photograph portrait of a person."
        })
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        img = make_dummy_image()
        result = validate_image_with_gemini(img)

        self.assertFalse(result["accepted"])
        self.assertEqual(result["decision"], "reject")
        self.assertEqual(result["reason_code"], "NOT_CHEST_XRAY")
        self.assertIn("Gambar tidak sesuai", result["message"])

    @patch("gemini_service.get_client")
    def test_gemini_rejects_poor_quality(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "is_chest_xray": True,
            "body_part": "chest",
            "projection": "PA",
            "is_grayscale": True,
            "image_quality": "poor",
            "scope_assessment": "uncertain",
            "decision": "reject",
            "reason_code": "POOR_QUALITY",
            "reason": "Severely blurry and unreadable radiograph."
        })
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        img = make_dummy_image()
        result = validate_image_with_gemini(img)

        self.assertFalse(result["accepted"])
        self.assertEqual(result["decision"], "reject")
        self.assertEqual(result["reason_code"], "POOR_QUALITY")
        self.assertIn("Kualitas citra tidak memadai", result["message"])

    @patch("gemini_service.get_client")
    def test_gemini_rejects_out_of_scope_disease(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "is_chest_xray": True,
            "body_part": "chest",
            "projection": "PA",
            "is_grayscale": True,
            "image_quality": "acceptable",
            "scope_assessment": "possible_other_disease",
            "decision": "reject",
            "reason_code": "OUT_OF_SCOPE",
            "reason": "Massive pleural effusion and severe cardiomegaly."
        })
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        img = make_dummy_image()
        result = validate_image_with_gemini(img)

        self.assertFalse(result["accepted"])
        self.assertEqual(result["decision"], "reject")
        self.assertEqual(result["reason_code"], "OUT_OF_SCOPE")
        self.assertIn("di luar cakupan klasifikasi", result["message"])

    @patch("gemini_service.get_client")
    def test_gemini_handles_uncertain_assessment(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "is_chest_xray": True,
            "body_part": "chest",
            "projection": "unknown",
            "is_grayscale": True,
            "image_quality": "uncertain",
            "scope_assessment": "uncertain",
            "decision": "uncertain",
            "reason_code": "UNCERTAIN",
            "reason": "Cannot reliably determine projection or findings."
        })
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        img = make_dummy_image()
        result = validate_image_with_gemini(img)

        self.assertFalse(result["accepted"])
        self.assertEqual(result["decision"], "uncertain")
        self.assertEqual(result["reason_code"], "UNCERTAIN")
        self.assertIn("belum dapat memastikan kesesuaian citra", result["message"])

    @patch("gemini_service.get_client")
    def test_server_enforces_consistency_when_gemini_hallucinates_pass(self, mock_get_client):
        """If Gemini outputs decision='pass' but projection='lateral' or is_grayscale=False, server must reject."""
        mock_response = MagicMock()
        # Contradictory response: claims pass, but projection is lateral
        mock_response.text = json.dumps({
            "is_chest_xray": True,
            "body_part": "chest",
            "projection": "lateral",
            "is_grayscale": True,
            "image_quality": "acceptable",
            "scope_assessment": "in_scope",
            "decision": "pass",
            "reason_code": "SUPPORTED_CHEST_XRAY",
            "reason": "Hallucinated pass."
        })
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        img = make_dummy_image()
        result = validate_image_with_gemini(img)

        self.assertFalse(result["accepted"])
        self.assertEqual(result["decision"], "reject")
        self.assertEqual(result["reason_code"], "LATERAL_PROJECTION")

    @patch("gemini_service.get_client")
    def test_gemini_service_unavailable_handled_safely(self, mock_get_client):
        """When Gemini API times out or fails all attempts, fail safely with SERVICE_ERROR."""
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception("503 Service Unavailable")
        mock_get_client.return_value = mock_client

        img = make_dummy_image()
        result = validate_image_with_gemini(img)

        self.assertFalse(result["accepted"])
        self.assertEqual(result["decision"], "error")
        self.assertEqual(result["reason_code"], "SERVICE_ERROR")
        self.assertIn("sedang tidak tersedia", result["message"])


class TestClipValidation(unittest.TestCase):
    """Test Stage 2: CLIP validation logic and acceptance rule."""

    @patch("image_validator.load_validator")
    def test_clip_passes_supported_frontal_cxr(self, mock_load):
        import torch
        mock_proc = MagicMock()
        mock_model = MagicMock()

        # Mock inputs and outputs
        mock_proc.return_value = {"input_ids": torch.tensor([[1]])}

        # Simulate category probabilities where frontal_chest_xray dominates
        # Prompts order matches CATEGORIES: frontal (3), lateral (2), other_body (3), other_modality (3), portrait (2), non_med (2)
        logits = torch.tensor([[5.0, 5.0, 5.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]])
        output = MagicMock()
        output.logits_per_image = logits
        mock_model.return_value = output
        mock_load.return_value = (mock_proc, mock_model)

        img = make_dummy_image()
        res = validate_clip(img)

        self.assertTrue(res["accepted"])
        self.assertEqual(res["decision"], "pass")
        self.assertEqual(res["reason_code"], "SUPPORTED_CHEST_XRAY")
        self.assertEqual(res["detected_category"], "frontal_chest_xray")
        self.assertIn("Melanjutkan klasifikasi", res["message"])

    @patch("image_validator.load_validator")
    def test_clip_rejects_lateral_projection(self, mock_load):
        import torch
        mock_proc = MagicMock()
        mock_model = MagicMock()
        mock_proc.return_value = {"input_ids": torch.tensor([[1]])}

        # Simulate lateral dominating
        # frontal (3 items): low, lateral (2 items): high
        logits = torch.tensor([[0.0, 0.0, 0.0, 6.0, 6.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]])
        output = MagicMock()
        output.logits_per_image = logits
        mock_model.return_value = output
        mock_load.return_value = (mock_proc, mock_model)

        img = make_dummy_image()
        res = validate_clip(img)

        self.assertFalse(res["accepted"])
        self.assertEqual(res["decision"], "reject")
        self.assertEqual(res["reason_code"], "LATERAL_PROJECTION")
        self.assertIn("Proyeksi citra tidak didukung", res["message"])

    @patch("image_validator.load_validator")
    def test_clip_rejects_non_medical_image(self, mock_load):
        import torch
        mock_proc = MagicMock()
        mock_model = MagicMock()
        mock_proc.return_value = {"input_ids": torch.tensor([[1]])}

        # Simulate non_medical dominating (last 2 items)
        logits = torch.tensor([[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 6.0, 6.0]])
        output = MagicMock()
        output.logits_per_image = logits
        mock_model.return_value = output
        mock_load.return_value = (mock_proc, mock_model)

        img = make_dummy_image()
        res = validate_clip(img)

        self.assertFalse(res["accepted"])
        self.assertEqual(res["decision"], "reject")
        self.assertEqual(res["reason_code"], "NOT_CHEST_XRAY")
        self.assertIn("Gambar tidak sesuai", res["message"])

    @patch("image_validator.load_validator")
    def test_clip_model_failure_handled_safely(self, mock_load):
        mock_load.side_effect = RuntimeError("CUDA out of memory or model file missing")

        img = make_dummy_image()
        res = validate_clip(img)

        self.assertFalse(res["accepted"])
        self.assertEqual(res["decision"], "error")
        self.assertEqual(res["reason_code"], "SERVICE_ERROR")
        self.assertIn("sedang tidak tersedia", res["message"])


class TestValidationPipelineIntegration(unittest.TestCase):
    """Test full sequential pipeline integration: Gemini first, CLIP second, QCNN third."""

    @patch("app.predict_image")
    @patch("app.generate_gradcam_result")
    @patch("app.get_bundle")
    @patch("app.validate_clip")
    @patch("app.validate_image_with_gemini")
    @patch("app.get_authenticated_user")
    def test_pipeline_proceeds_to_qcnn_when_both_pass(
        self, mock_auth, mock_gemini, mock_clip, mock_bundle, mock_gradcam, mock_predict
    ):
        from app import app

        mock_auth.return_value = ({"id": "doc-1", "role": "doctor", "status": "approved", "has_str": True, "has_sip": True}, None, 200)

        # Gemini passes
        mock_gemini.return_value = {
            "accepted": True,
            "stage": "gemini",
            "decision": "pass",
            "reason_code": "SUPPORTED_CHEST_XRAY",
            "message": "Gambar berhasil divalidasi.",
            "is_chest_xray": True,
            "body_part": "chest",
            "projection": "PA",
            "is_grayscale": True,
            "image_quality": "acceptable",
            "scope_assessment": "in_scope",
        }

        # CLIP passes
        mock_clip.return_value = {
            "accepted": True,
            "stage": "clip",
            "decision": "pass",
            "reason_code": "SUPPORTED_CHEST_XRAY",
            "message": "Gambar berhasil divalidasi.",
            "chest_score": 0.85,
            "margin": 0.70,
            "detected_category": "frontal_chest_xray",
        }

        # QCNN mock
        mock_predict.return_value = {
            "label": "Normal",
            "confidence": 0.94,
            "class_index": 0,
            "probabilities": {"Normal": 0.94, "TB": 0.06},
        }
        mock_gradcam.return_value = ("data:image/png;base64,dummy", {"summary": "normal"})
        mock_b = MagicMock()
        mock_b.model.n_qubits = 6
        mock_b.threshold = 0.5
        mock_bundle.return_value = mock_b

        client = app.test_client()

        img = make_dummy_image()
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        res = client.post(
            "/api/predict",
            data={"image": (buf, "test_cxr.png")},
            content_type="multipart/form-data",
            headers={"Authorization": "Bearer mock-token"},
        )

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["label"], "Normal")
        self.assertIn("validation", data)
        self.assertEqual(data["validation"]["status"], "passed")
        self.assertEqual(data["validation"]["gemini"]["decision"], "pass")
        self.assertEqual(data["validation"]["clip"]["decision"], "pass")

        # Verify execution order: both were called, and predict_image was called
        mock_gemini.assert_called_once()
        mock_clip.assert_called_once()
        mock_predict.assert_called_once()

    @patch("app.predict_image")
    @patch("app.validate_clip")
    @patch("app.validate_image_with_gemini")
    @patch("app.get_authenticated_user")
    def test_gemini_rejection_prevents_clip_and_qcnn(
        self, mock_auth, mock_gemini, mock_clip, mock_predict
    ):
        from app import app

        mock_auth.return_value = ({"id": "doc-1", "role": "doctor", "status": "approved", "has_str": True, "has_sip": True}, None, 200)

        # Gemini rejects because it's a selfie / photo
        mock_gemini.return_value = {
            "accepted": False,
            "stage": "gemini",
            "decision": "reject",
            "reason_code": "NOT_CHEST_XRAY",
            "message": "Gambar tidak sesuai. Silakan unggah citra Chest X-Ray yang sesuai.",
            "is_chest_xray": False,
        }

        client = app.test_client()
        img = make_dummy_image()
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        res = client.post(
            "/api/predict",
            data={"image": (buf, "selfie.png")},
            content_type="multipart/form-data",
            headers={"Authorization": "Bearer mock-token"},
        )

        self.assertEqual(res.status_code, 422)
        data = res.get_json()
        self.assertFalse(data["accepted"])
        self.assertEqual(data["stage"], "gemini")
        self.assertEqual(data["reason_code"], "NOT_CHEST_XRAY")

        # CRITICAL VERIFICATION: CLIP and QCNN must NEVER be called if Gemini rejected
        mock_gemini.assert_called_once()
        mock_clip.assert_not_called()
        mock_predict.assert_not_called()

    @patch("app.predict_image")
    @patch("app.validate_clip")
    @patch("app.validate_image_with_gemini")
    @patch("app.get_authenticated_user")
    def test_clip_rejection_prevents_qcnn(
        self, mock_auth, mock_gemini, mock_clip, mock_predict
    ):
        from app import app

        mock_auth.return_value = ({"id": "doc-1", "role": "doctor", "status": "approved", "has_str": True, "has_sip": True}, None, 200)

        # Gemini passed
        mock_gemini.return_value = {
            "accepted": True,
            "stage": "gemini",
            "decision": "pass",
            "reason_code": "SUPPORTED_CHEST_XRAY",
            "message": "Gambar berhasil divalidasi.",
        }

        # CLIP rejects lateral projection
        mock_clip.return_value = {
            "accepted": False,
            "stage": "clip",
            "decision": "reject",
            "reason_code": "LATERAL_PROJECTION",
            "message": "Proyeksi citra tidak didukung. Silakan unggah Chest X-Ray tampak depan (PA/AP).",
            "detected_category": "lateral_chest_xray",
        }

        client = app.test_client()
        img = make_dummy_image()
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        res = client.post(
            "/api/predict",
            data={"image": (buf, "lateral.png")},
            content_type="multipart/form-data",
            headers={"Authorization": "Bearer mock-token"},
        )

        self.assertEqual(res.status_code, 422)
        data = res.get_json()
        self.assertFalse(data["accepted"])
        self.assertEqual(data["stage"], "clip")
        self.assertEqual(data["reason_code"], "LATERAL_PROJECTION")

        # CRITICAL VERIFICATION: QCNN must NEVER be called if CLIP rejected
        mock_gemini.assert_called_once()
        mock_clip.assert_called_once()
        mock_predict.assert_not_called()

    @patch("app.predict_image")
    @patch("app.validate_clip")
    @patch("app.validate_image_with_gemini")
    @patch("app.get_authenticated_user")
    def test_gemini_service_error_fails_safely_503(
        self, mock_auth, mock_gemini, mock_clip, mock_predict
    ):
        from app import app

        mock_auth.return_value = ({"id": "doc-1", "role": "doctor", "status": "approved", "has_str": True, "has_sip": True}, None, 200)

        # Gemini returns service error
        mock_gemini.return_value = {
            "accepted": False,
            "stage": "gemini",
            "decision": "error",
            "reason_code": "SERVICE_ERROR",
            "message": "Validasi gambar sedang tidak tersedia. Silakan coba kembali beberapa saat lagi.",
        }

        client = app.test_client()
        img = make_dummy_image()
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        res = client.post(
            "/api/predict",
            data={"image": (buf, "test.png")},
            content_type="multipart/form-data",
            headers={"Authorization": "Bearer mock-token"},
        )

        self.assertEqual(res.status_code, 503)
        data = res.get_json()
        self.assertFalse(data["accepted"])
        self.assertEqual(data["stage"], "gemini")
        self.assertEqual(data["reason_code"], "SERVICE_ERROR")

        # QCNN and CLIP must not be run
        mock_clip.assert_not_called()
        mock_predict.assert_not_called()


class TestDoctorAccountVerificationGate(unittest.TestCase):
    """Tests for Doctor Account Verification Gate at /api/predict and /api/interpret."""

    def setUp(self):
        from app import app
        self.app = app
        self.client = app.test_client()

    def _make_dummy_request(self, token="mock-token"):
        img = make_dummy_image()
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return self.client.post(
            "/api/predict",
            data={"image": (buf, "test.png")},
            content_type="multipart/form-data",
            headers={"Authorization": f"Bearer {token}"} if token else {},
        )

    @patch("app.get_authenticated_user")
    def test_unauthenticated_request_returns_401(self, mock_auth):
        mock_auth.return_value = (None, "Otentikasi diperlukan.", 401)
        res = self._make_dummy_request(token=None)
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertEqual(data["error"], "UNAUTHORIZED")

    @patch("app.get_authenticated_user")
    def test_newly_registered_doctor_no_str_no_sip_returns_403_incomplete(self, mock_auth):
        # Scenario 1 & 2 & 4: New doctor without STR and SIP
        mock_auth.return_value = (
            {"id": "doc-new", "role": "doctor", "status": "pending", "has_str": False, "has_sip": False},
            None,
            200,
        )
        res = self._make_dummy_request()
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertEqual(data["error"], "DOCUMENTS_INCOMPLETE")
        self.assertIn("STR (Surat Tanda Registrasi)", data["missing_documents"])
        self.assertIn("SIP (Surat Izin Praktik)", data["missing_documents"])

    @patch("app.get_authenticated_user")
    def test_doctor_with_only_str_returns_403_incomplete(self, mock_auth):
        # Scenario 5: Doctor submits only STR, SIP is missing
        mock_auth.return_value = (
            {"id": "doc-str-only", "role": "doctor", "status": "pending", "has_str": True, "has_sip": False},
            None,
            200,
        )
        res = self._make_dummy_request()
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertEqual(data["error"], "DOCUMENTS_INCOMPLETE")
        self.assertNotIn("STR (Surat Tanda Registrasi)", data["missing_documents"])
        self.assertIn("SIP (Surat Izin Praktik)", data["missing_documents"])

    @patch("app.get_authenticated_user")
    def test_doctor_with_only_sip_returns_403_incomplete(self, mock_auth):
        # Scenario 6: Doctor submits only SIP, STR is missing
        mock_auth.return_value = (
            {"id": "doc-sip-only", "role": "doctor", "status": "pending", "has_str": False, "has_sip": True},
            None,
            200,
        )
        res = self._make_dummy_request()
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertEqual(data["error"], "DOCUMENTS_INCOMPLETE")
        self.assertIn("STR (Surat Tanda Registrasi)", data["missing_documents"])
        self.assertNotIn("SIP (Surat Izin Praktik)", data["missing_documents"])

    @patch("app.get_authenticated_user")
    def test_doctor_with_both_docs_but_status_pending_returns_403_not_approved(self, mock_auth):
        # Both documents submitted, but pending admin review
        mock_auth.return_value = (
            {"id": "doc-pending", "role": "doctor", "status": "pending", "has_str": True, "has_sip": True},
            None,
            200,
        )
        res = self._make_dummy_request()
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertEqual(data["error"], "ACCOUNT_NOT_APPROVED")

    @patch("app.get_authenticated_user")
    def test_doctor_with_both_docs_but_status_rejected_returns_403_not_approved(self, mock_auth):
        # Both documents submitted, but rejected by admin
        mock_auth.return_value = (
            {"id": "doc-rejected", "role": "doctor", "status": "rejected", "has_str": True, "has_sip": True},
            None,
            200,
        )
        res = self._make_dummy_request()
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertEqual(data["error"], "ACCOUNT_NOT_APPROVED")

    @patch("app.get_authenticated_user")
    def test_doctor_with_both_docs_but_status_suspended_returns_403_not_approved(self, mock_auth):
        # Both documents submitted, but suspended by admin
        mock_auth.return_value = (
            {"id": "doc-suspended", "role": "doctor", "status": "suspended", "has_str": True, "has_sip": True},
            None,
            200,
        )
        res = self._make_dummy_request()
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertEqual(data["error"], "ACCOUNT_NOT_APPROVED")

    @patch("app.predict_image")
    @patch("app.generate_gradcam_result")
    @patch("app.get_bundle")
    @patch("app.validate_clip")
    @patch("app.validate_image_with_gemini")
    @patch("app.get_authenticated_user")
    def test_doctor_with_both_docs_and_approved_allows_access(
        self, mock_auth, mock_gemini, mock_clip, mock_bundle, mock_gradcam, mock_predict
    ):
        # Scenario 7 & 8: Verified doctor with both docs and approved status
        mock_auth.return_value = (
            {"id": "doc-verified", "role": "doctor", "status": "approved", "has_str": True, "has_sip": True},
            None,
            200,
        )
        mock_gemini.return_value = {
            "accepted": True,
            "stage": "gemini",
            "decision": "pass",
            "reason_code": "SUPPORTED_CHEST_XRAY",
            "message": "Gambar berhasil divalidasi.",
            "is_chest_xray": True,
            "body_part": "chest",
            "projection": "PA",
            "is_grayscale": True,
            "image_quality": "acceptable",
            "scope_assessment": "in_scope",
        }
        mock_clip.return_value = {
            "accepted": True,
            "stage": "clip",
            "decision": "pass",
            "reason_code": "SUPPORTED_CHEST_XRAY",
            "message": "Gambar berhasil divalidasi.",
            "chest_score": 0.85,
            "margin": 0.70,
            "detected_category": "frontal_chest_xray",
        }
        mock_predict.return_value = {"label": "Normal", "confidence": 0.95, "probabilities": {"Normal": 0.95, "TB": 0.05}, "class_index": 0}
        mock_gradcam.return_value = ("data:image/png;base64,dummy", {"summary": "normal"})
        mock_b = MagicMock()
        mock_b.model.n_qubits = 6
        mock_b.threshold = 0.5
        mock_bundle.return_value = mock_b

        res = self._make_dummy_request()
        self.assertEqual(res.status_code, 200)

    @patch("app.predict_image")
    @patch("app.generate_gradcam_result")
    @patch("app.get_bundle")
    @patch("app.validate_clip")
    @patch("app.validate_image_with_gemini")
    @patch("app.get_authenticated_user")
    def test_admin_role_allows_access_without_doctor_docs(
        self, mock_auth, mock_gemini, mock_clip, mock_bundle, mock_gradcam, mock_predict
    ):
        # Scenario 9: Admin access unchanged
        mock_auth.return_value = (
            {"id": "admin-1", "role": "admin", "status": "approved", "has_str": False, "has_sip": False},
            None,
            200,
        )
        mock_gemini.return_value = {
            "accepted": True,
            "stage": "gemini",
            "decision": "pass",
            "reason_code": "SUPPORTED_CHEST_XRAY",
            "message": "Gambar berhasil divalidasi.",
            "is_chest_xray": True,
            "body_part": "chest",
            "projection": "PA",
            "is_grayscale": True,
            "image_quality": "acceptable",
            "scope_assessment": "in_scope",
        }
        mock_clip.return_value = {
            "accepted": True,
            "stage": "clip",
            "decision": "pass",
            "reason_code": "SUPPORTED_CHEST_XRAY",
            "message": "Gambar berhasil divalidasi.",
            "chest_score": 0.85,
            "margin": 0.70,
            "detected_category": "frontal_chest_xray",
        }
        mock_predict.return_value = {"label": "Normal", "confidence": 0.95, "probabilities": {"Normal": 0.95, "TB": 0.05}, "class_index": 0}
        mock_gradcam.return_value = ("data:image/png;base64,dummy", {"summary": "normal"})
        mock_b = MagicMock()
        mock_b.model.n_qubits = 6
        mock_b.threshold = 0.5
        mock_bundle.return_value = mock_b

        res = self._make_dummy_request()
        self.assertEqual(res.status_code, 200)


if __name__ == "__main__":
    unittest.main()
