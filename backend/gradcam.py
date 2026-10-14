"""Grad-CAM heatmap generation and overlay onto CXR images."""

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
    img = img.clamp(0, 1).permute(1, 2, 0).numpy()
    return img


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
    """Return (overlay RGB uint8, heatmap float 0-1) for the target class."""
    model = bundle.model
    model.eval()
    tensor = bundle.transform(image).unsqueeze(0).to(bundle.device)
    captured: dict[str, torch.Tensor] = {}

    def _hook(_module, _inp, output):
        output.retain_grad()
        captured["act"] = output

    handle = model.features.register_forward_hook(_hook)
    try:
        logits = model(tensor)
        if target_index is None:
            target_index = int(torch.argmax(logits, dim=1).item())
        model.zero_grad(set_to_none=True)
        logits[0, int(target_index)].backward()
        features = captured.get("act")
        if features is None or features.grad is None:
            raise RuntimeError("Grad-CAM failed: missing activations or gradients.")
        weights = features.grad.mean(dim=(2, 3), keepdim=True)
        cam = F.relu((weights * features).sum(dim=1, keepdim=True))
        cam = F.interpolate(cam, size=tensor.shape[-2:], mode="bilinear", align_corners=False)
        cam_np = cam.squeeze().detach().cpu().numpy()
    finally:
        handle.remove()

    cam_min, cam_max = float(cam_np.min()), float(cam_np.max())
    heatmap = (cam_np - cam_min) / (cam_max - cam_min + 1e-8)
    base = _tensor_to_display_rgb(tensor)
    overlay = 0.45 * _jet_colormap(heatmap) + 0.55 * base
    overlay_uint8 = (np.clip(overlay, 0, 1) * 255).astype(np.uint8)
    return overlay_uint8, heatmap


def overlay_to_data_url(overlay_rgb: np.ndarray) -> str:
    image = Image.fromarray(overlay_rgb, mode="RGB")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def generate_gradcam_data_url(
    bundle: ModelBundle,
    image: Image.Image,
    target_index: int | None = None,
) -> str:
    overlay, _heatmap = compute_gradcam(bundle, image, target_index=target_index)
    return overlay_to_data_url(overlay)
