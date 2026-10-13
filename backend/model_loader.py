"""HQCNN architecture, checkpoint loading, transforms, and inference."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
import pennylane as qml
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

logger = logging.getLogger(__name__)

CLASS_NAMES = ("Normal", "TB")
N_QUBITS = 6
N_QLAYERS = 2
IMAGE_SIZE = 224
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def get_device(preference: str = "auto") -> torch.device:
    if preference == "cpu":
        return torch.device("cpu")
    if preference == "cuda" and torch.cuda.is_available():
        return torch.device("cuda")
    if preference == "auto" and torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def build_cxr_transform() -> transforms.Compose:
    return transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )


def _quantum_layer(n_qubits: int = N_QUBITS, n_layers: int = N_QLAYERS) -> qml.qnn.TorchLayer:
    dev = qml.device("default.qubit", wires=n_qubits)

    @qml.qnode(dev, interface="torch")
    def circuit(inputs, weights):
        qml.AngleEmbedding(inputs, wires=range(n_qubits), rotation="Y")
        qml.StronglyEntanglingLayers(weights, wires=range(n_qubits))
        return [qml.expval(qml.PauliZ(i)) for i in range(n_qubits)]

    weight_shapes = {"weights": (n_layers, n_qubits, 3)}
    return qml.qnn.TorchLayer(circuit, weight_shapes)


class HQCNN(nn.Module):
    """Hybrid Quantum CNN: EfficientNet-B0 features + 6-qubit VQC + linear head."""

    def __init__(self, n_classes: int = 2, n_qubits: int = N_QUBITS, n_qlayers: int = N_QLAYERS):
        super().__init__()
        self.n_qubits = n_qubits
        backbone = models.efficientnet_b0(weights=None)
        self.features = backbone.features
        self.avgpool = nn.AdaptiveAvgPool2d(1)
        in_features = backbone.classifier[1].in_features
        self.pre_quantum = nn.Sequential(
            nn.Flatten(),
            nn.Linear(in_features, n_qubits),
            nn.Tanh(),
        )
        self.quantum = _quantum_layer(n_qubits=n_qubits, n_layers=n_qlayers)
        self.classifier = nn.Linear(n_qubits, n_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.avgpool(x)
        x = self.pre_quantum(x)
        x = self.quantum(x)
        return self.classifier(x)


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
        if all(isinstance(k, str) for k in payload.keys()):
            tensor_like = {k: v for k, v in payload.items() if torch.is_tensor(v)}
            if tensor_like:
                return tensor_like
    raise ValueError("Unrecognized checkpoint format for best.pt")


def _strip_module_prefix(state_dict: dict[str, torch.Tensor]) -> dict[str, torch.Tensor]:
    if all(k.startswith("module.") for k in state_dict):
        return {k[len("module.") :]: v for k, v in state_dict.items()}
    return state_dict


class ModelBundle:
    def __init__(self, model: HQCNN, device: torch.device, transform: transforms.Compose):
        self.model = model
        self.device = device
        self.transform = transform


def load_model(checkpoint_path: str | Path, device_preference: str = "auto") -> ModelBundle:
    device = get_device(device_preference)
    path = Path(checkpoint_path)
    model = HQCNN(n_classes=len(CLASS_NAMES), n_qubits=N_QUBITS, n_qlayers=N_QLAYERS)
    model.to(device)

    if not path.exists():
        logger.warning("Checkpoint not found at %s — using randomly initialized weights.", path)
        model.eval()
        return ModelBundle(model=model, device=device, transform=build_cxr_transform())

    payload = torch.load(path, map_location=device, weights_only=False)
    state_dict = _strip_module_prefix(_unwrap_state_dict(payload))
    incompatible = model.load_state_dict(state_dict, strict=False)
    if incompatible.missing_keys or incompatible.unexpected_keys:
        logger.warning(
            "Checkpoint loaded with mismatches. missing=%s unexpected=%s",
            incompatible.missing_keys,
            incompatible.unexpected_keys,
        )
    model.eval()
    logger.info("Loaded HQCNN from %s on %s", path, device)
    return ModelBundle(model=model, device=device, transform=build_cxr_transform())


def pil_from_bytes(data: bytes) -> Image.Image:
    from io import BytesIO

    image = Image.open(BytesIO(data))
    if image.mode != "RGB":
        image = image.convert("RGB")
    return image


@torch.no_grad()
def predict_image(bundle: ModelBundle, image: Image.Image) -> dict[str, Any]:
    tensor = bundle.transform(image).unsqueeze(0).to(bundle.device)
    logits = bundle.model(tensor)
    probs = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()
    idx = int(np.argmax(probs))
    probabilities = {name: float(probs[i]) for i, name in enumerate(CLASS_NAMES)}
    return {
        "label": CLASS_NAMES[idx],
        "confidence": float(probs[idx]),
        "probabilities": probabilities,
        "class_index": idx,
    }
