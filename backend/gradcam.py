"""Grad-CAM heatmap generation for QORA Hybrid QCNN."""

from __future__ import annotations

import base64
from io import BytesIO

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

from model_loader import IMAGENET_MEAN, IMAGENET_STD, ModelBundle


def _tensor_to_display_rgb(tensor: torch.Tensor) -> np.ndarray:
    img = tensor.detach().cpu().squeeze(0).clone()
    mean = torch.tensor(IMAGENET_MEAN).view(3, 1, 1)
    std = torch.tensor(IMAGENET_STD).view(3, 1, 1)
    img = img * std + mean
    return img.clamp(0, 1).permute(1, 2, 0).numpy()


def _jet_colormap(values: np.ndarray) -> np.ndarray:
    x = np.clip(values, 0.0, 1.0)
    r = np.clip(1.5 - np.abs(4.0 * x - 3.0), 0, 1)
    g = np.clip(1.5 - np.abs(4.0 * x - 2.0), 0, 1)
    b = np.clip(1.5 - np.abs(4.0 * x - 1.0), 0, 1)
    return np.stack([r, g, b], axis=-1)


def compute_gradcam(
    bundle: ModelBundle,
    image: Image.Image,
    target_index: int | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Return Grad-CAM overlay (RGB uint8) and normalized heatmap."""
    model = bundle.model
    model.eval()
    tensor = bundle.transform(image.convert("RGB")).unsqueeze(0).to(bundle.device)
    captured: dict[str, torch.Tensor] = {}

    def _hook(_module, _inputs, output):
        output.retain_grad()
        captured["activations"] = output

    handle = model.features.register_forward_hook(_hook)

    try:
        with torch.enable_grad():
            model.zero_grad(set_to_none=True)
            logits = model(tensor)

            if logits.numel() != 1:
                raise RuntimeError(
                    f"Unexpected model output shape: {tuple(logits.shape)}"
                )

            logit = logits.reshape(-1)[0]
            prob_tb = torch.sigmoid(logit).item()

            if target_index is None:
                target_index = 1 if prob_tb >= bundle.threshold else 0

            if target_index not in (0, 1):
                raise ValueError("target_index harus 0 (Normal) atau 1 (TB).")

            target_score = logit if target_index == 1 else -logit
            target_score.backward()

            activations = captured.get("activations")
            if activations is None or activations.grad is None:
                raise RuntimeError(
                    "Grad-CAM gagal: activations atau gradients tidak ditemukan."
                )

            gradients = activations.grad
            weights = gradients.mean(dim=(2, 3), keepdim=True)
            cam = F.relu((weights * activations).sum(dim=1, keepdim=True))
            cam = F.interpolate(
                cam,
                size=tensor.shape[-2:],
                mode="bilinear",
                align_corners=False,
            )
            cam_np = cam.squeeze().detach().cpu().numpy()

    finally:
        handle.remove()
        model.zero_grad(set_to_none=True)

    if not np.isfinite(cam_np).all():
        raise RuntimeError("Grad-CAM menghasilkan nilai yang tidak valid.")

    cam_min = float(cam_np.min())
    cam_max = float(cam_np.max())

    if cam_max - cam_min < 1e-8:
        heatmap = np.zeros_like(cam_np, dtype=np.float32)
    else:
        heatmap = ((cam_np - cam_min) / (cam_max - cam_min)).astype(np.float32)

    base = _tensor_to_display_rgb(tensor)
    overlay = 0.45 * _jet_colormap(heatmap) + 0.55 * base
    overlay_uint8 = (np.clip(overlay, 0, 1) * 255).astype(np.uint8)

    return overlay_uint8, heatmap


def analyze_gradcam_heatmap(heatmap: np.ndarray) -> dict:
    """Analyze spatial distribution of Grad-CAM activations across thoracic lung zones."""
    h, w = heatmap.shape
    y1, y2 = h // 3, (2 * h) // 3
    mid_x = w // 2

    # Standard PA Chest X-Ray orientation:
    # Patient right lung is on the left side of the image
    # Patient left lung is on the right side of the image
    zones = {
        "Lapang Atas Paru Kanan (Right Upper Lung Zone)": heatmap[0:y1, 0:mid_x],
        "Lapang Tengah Paru Kanan (Right Mid Lung Zone)": heatmap[y1:y2, 0:mid_x],
        "Lapang Bawah Paru Kanan (Right Lower Lung Zone)": heatmap[y2:h, 0:mid_x],
        "Lapang Atas Paru Kiri (Left Upper Lung Zone)": heatmap[0:y1, mid_x:w],
        "Lapang Tengah Paru Kiri (Left Mid Lung Zone)": heatmap[y1:y2, mid_x:w],
        "Lapang Bawah Paru Kiri (Left Lower Lung Zone)": heatmap[y2:h, mid_x:w],
    }

    zone_stats = []
    for name, patch in zones.items():
        if patch.size == 0:
            continue
        max_val = float(patch.max())
        mean_val = float(patch.mean())
        coverage = float((patch > 0.5).mean())
        zone_stats.append({
            "zone": name,
            "max_intensity": round(max_val, 3),
            "mean_intensity": round(mean_val, 3),
            "coverage": round(coverage, 3),
        })

    zone_stats.sort(key=lambda z: (z["max_intensity"], z["coverage"]), reverse=True)
    primary_zone = zone_stats[0]["zone"] if zone_stats else "Area tidak spesifik"
    primary_max = zone_stats[0]["max_intensity"] if zone_stats else 0.0
    overall_high_ratio = float((heatmap > 0.5).mean())

    summary = (
        f"Fokus atensi tertinggi berada di {primary_zone} dengan intensitas puncak {primary_max:.1%}. "
        f"Sekitar {overall_high_ratio:.1%} area lapang pandang memiliki aktivasi fitur signifikan."
    )

    return {
        "primary_zone": primary_zone,
        "primary_max": primary_max,
        "high_activation_coverage": round(overall_high_ratio, 3),
        "zones": zone_stats,
        "summary": summary
    }


def overlay_to_data_url(overlay_rgb: np.ndarray) -> str:
    image = Image.fromarray(overlay_rgb)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def generate_gradcam_data_url(
    bundle: ModelBundle,
    image: Image.Image,
    target_index: int | None = None,
) -> str:
    overlay, _ = compute_gradcam(bundle, image, target_index=target_index)
    return overlay_to_data_url(overlay)


def generate_gradcam_result(
    bundle: ModelBundle,
    image: Image.Image,
    target_index: int | None = None,
) -> tuple[str, dict]:
    """Return both Grad-CAM overlay data URL and spatial heatmap analysis."""
    overlay, heatmap = compute_gradcam(bundle, image, target_index=target_index)
    analysis = analyze_gradcam_heatmap(heatmap)
    return overlay_to_data_url(overlay), analysis