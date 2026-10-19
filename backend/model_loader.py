"""QORA Hybrid QCNN: ResNet-50, checkpoint loading, and inference."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
import pennylane as qml
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torchvision import models, transforms

logger = logging.getLogger(__name__)

CLASS_NAMES = ("Normal", "TB")
N_QUBITS = 6
N_QLAYERS = 3
IMAGE_SIZE = 224
IMAGENET_MEAN = (0.0, 0.0, 0.0)
IMAGENET_STD = (1.0, 1.0, 1.0)


def get_device(preference: str = "auto") -> torch.device:
    preference = preference.lower()
    if preference == "cpu":
        return torch.device("cpu")
    if preference == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA tidak tersedia.")
        return torch.device("cuda")
    if preference == "auto" and torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def build_cxr_transform(
    image_size: int = IMAGE_SIZE,
    normalization: str = "proposal_01",
) -> transforms.Compose:
    operations = [
        transforms.Resize(
            (image_size, image_size),
            interpolation=transforms.InterpolationMode.BILINEAR,
        ),
        transforms.ToTensor(),
    ]
    if normalization == "imagenet":
        operations.append(
            transforms.Normalize(
                mean=(0.485, 0.456, 0.406),
                std=(0.229, 0.224, 0.225),
            )
        )
    elif normalization != "proposal_01":
        raise ValueError(f"Normalisasi tidak dikenal: {normalization}")
    return transforms.Compose(operations)


class QuantumFeatures(nn.Module):
    """Quantum circuit sesuai konfigurasi QORA Version 7."""

    def __init__(self, cfg):
        super().__init__()
        if cfg["basis"] != "XYZ":
            raise ValueError("Checkpoint membutuhkan basis XYZ.")
        if cfg["rotations"] != "RY_RZ":
            raise ValueError("Checkpoint membutuhkan rotasi RY_RZ.")

        n = int(cfg["n_qubits"])
        depth = int(cfg["q_depth"])
        dev = qml.device("default.qubit", wires=n, shots=None)

        @qml.qnode(dev, interface="torch", diff_method="backprop")
        def circuit(inputs, weights):
            for i in range(n):
                qml.RY(inputs[..., i], wires=i)
            for layer in range(depth):
                for i in range(n):
                    qml.RY(weights[layer, i, 0], wires=i)
                    qml.RZ(weights[layer, i, 1], wires=i)
                for i in range(n):
                    qml.CNOT(wires=[i, (i + 1) % n])
            observables = [qml.PauliX, qml.PauliY, qml.PauliZ]
            return [qml.expval(op(i)) for op in observables for i in range(n)]

        self.layer = qml.qnn.TorchLayer(
            circuit, {"weights": (depth, n, 2)}
        )
        self.output_dim = n * 3

    def forward(self, x):
        return self.layer(x).to(dtype=x.dtype)


class HQCNN(nn.Module):
    """ResNet-50 + Adaptive Pooling + Quantum Features + Binary Head."""

    def __init__(
        self,
        n_classes: int = 2,
        n_qubits: int = N_QUBITS,
        n_qlayers: int = N_QLAYERS,
        dropout: float = 0.5,
        angle_scaling: str = "minmax",
    ):
        super().__init__()
        if n_classes != 2:
            raise ValueError("QORA hanya mendukung klasifikasi biner.")

        self.n_qubits = n_qubits
        self.n_qlayers = n_qlayers
        self.angle_scaling = angle_scaling

        backbone = models.resnet50(weights=None)
        self.features = nn.Sequential(*list(backbone.children())[:-2])
        self.quantum = QuantumFeatures({
            "n_qubits": n_qubits,
            "q_depth": n_qlayers,
            "basis": "XYZ",
            "rotations": "RY_RZ",
        })
        self.head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(self.quantum.output_dim, 1),
        )

    def forward(self, x: torch.Tensor, return_features: bool = False):
        maps = self.features(x)
        pooled = F.adaptive_avg_pool2d(maps, 1).flatten(1)
        six_features = F.adaptive_avg_pool1d(
            pooled.unsqueeze(1), self.n_qubits
        ).squeeze(1)

        if self.angle_scaling == "minmax":
            low = six_features.amin(dim=1, keepdim=True)
            span = six_features.amax(dim=1, keepdim=True) - low
            angles = torch.pi * (six_features - low) / span.clamp_min(1e-6)
        elif self.angle_scaling == "sigmoid":
            angles = torch.pi * torch.sigmoid(six_features)
        else:
            raise ValueError(f"Angle scaling tidak dikenal: {self.angle_scaling}")

        quantum_features = self.quantum(angles)
        logits = self.head(quantum_features).squeeze(-1)

        if return_features:
            return logits, maps
        return logits


def _unwrap_state_dict(payload: Any) -> dict[str, torch.Tensor]:
    if isinstance(payload, nn.Module):
        return payload.state_dict()
    if isinstance(payload, dict):
        for key in ("state_dict", "model_state_dict", "model", "net"):
            inner = payload.get(key)
            if isinstance(inner, dict):
                return inner
            if isinstance(inner, nn.Module):
                return inner.state_dict()
        if all(
            isinstance(k, str) and torch.is_tensor(v)
            for k, v in payload.items()
        ):
            return payload
    raise ValueError("Format checkpoint best.pt tidak dikenali.")


def _strip_module_prefix(state_dict: dict[str, torch.Tensor]):
    if all(key.startswith("module.") for key in state_dict):
        return {
            key[len("module."):]: value
            for key, value in state_dict.items()
        }
    return state_dict


class ModelBundle:
    def __init__(self, model, device, transform, threshold):
        self.model = model
        self.device = device
        self.transform = transform
        self.threshold = float(threshold)


def load_model(
    checkpoint_path: str | Path,
    device_preference: str = "auto",
) -> ModelBundle:
    device = get_device(device_preference)
    path = Path(checkpoint_path)

    if not path.exists():
        raise FileNotFoundError(f"Checkpoint QORA tidak ditemukan: {path}")

    logger.info("Loading QORA checkpoint: %s", path)
    payload = torch.load(path, map_location="cpu", weights_only=True)

    if not isinstance(payload, dict):
        raise ValueError("Checkpoint harus berupa dictionary.")

    cfg = payload.get("config", {})
    backbone = payload.get("backbone")

    if backbone != "resnet50":
        raise ValueError(f"Backbone tidak sesuai: {backbone}")
    if cfg.get("basis") != "XYZ":
        raise ValueError("Checkpoint tidak menggunakan measurement XYZ.")
    if cfg.get("rotations") != "RY_RZ":
        raise ValueError("Checkpoint tidak menggunakan rotasi RY_RZ.")
    if "threshold" not in payload:
        raise ValueError("Threshold tidak ditemukan dalam checkpoint.")

    n_qubits = int(cfg.get("n_qubits", N_QUBITS))
    q_depth = int(cfg.get("q_depth", N_QLAYERS))
    dropout = float(cfg.get("dropout", 0.5))
    angle_scaling = cfg.get("angle_scaling", "minmax")
    normalization = cfg.get("normalization", "proposal_01")
    image_size = int(cfg.get("image_size", IMAGE_SIZE))
    threshold = float(payload["threshold"])

    if not np.isfinite(threshold) or not 0 <= threshold <= 1:
        raise ValueError(f"Threshold tidak valid: {threshold}")

    model = HQCNN(
        n_classes=2,
        n_qubits=n_qubits,
        n_qlayers=q_depth,
        dropout=dropout,
        angle_scaling=angle_scaling,
    )

    state_dict = _strip_module_prefix(_unwrap_state_dict(payload))
    model.load_state_dict(state_dict, strict=True)
    model.to(device)
    model.eval()

    transform = build_cxr_transform(
        image_size=image_size,
        normalization=normalization,
    )

    logger.info(
        "QORA loaded: Backbone=%s Device=%s Threshold=%.8f",
        backbone, device, threshold,
    )
    return ModelBundle(model, device, transform, threshold)


def pil_from_bytes(data: bytes) -> Image.Image:
    from io import BytesIO
    image = Image.open(BytesIO(data))
    return image.convert("RGB") if image.mode != "RGB" else image


@torch.no_grad()
def predict_image(bundle: ModelBundle, image: Image.Image) -> dict[str, Any]:
    tensor = bundle.transform(image.convert("RGB")).unsqueeze(0).to(bundle.device)
    logits = bundle.model(tensor)

    if logits.numel() != 1:
        raise RuntimeError(f"Output model tidak sesuai: {tuple(logits.shape)}")

    prob_tb = float(torch.sigmoid(logits.reshape(-1)[0]).item())
    prob_normal = 1.0 - prob_tb
    probabilities = {"Normal": prob_normal, "TB": prob_tb}

    idx = 1 if prob_tb >= bundle.threshold else 0
    label = CLASS_NAMES[idx]

    return {
        "label": label,
        "confidence": float(probabilities[label]),
        "probabilities": probabilities,
        "class_index": idx,
    }