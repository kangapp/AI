#!/usr/bin/env python3
"""
Theme Clone Quality Scorer
Computes SSIM and LPIPS scores to validate theme application quality.
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import torch
    import torchvision
    from torchmetrics.image import StructuralSimilarityIndexMeasure
    from lpips import LPIPS
    HAS_LPIPS = True
except ImportError:
    HAS_LPIPS = False

try:
    from PIL import Image
    import numpy as np
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


def load_image(path: str) -> torch.Tensor:
    """Load image and convert to tensor format for scoring."""
    img = Image.open(path).convert('RGB')
    img = np.array(img).astype(np.float32) / 255.0
    img = torch.from_numpy(img).permute(2, 0, 1).unsqueeze(0)
    return img


def compute_ssim(img1: torch.Tensor, img2: torch.Tensor) -> float:
    """Compute SSIM between two images. Returns value between -1 and 1."""
    ssim = StructuralSimilarityIndexMeasure()
    return float(ssim(img1, img2).item())


def compute_lpips(img1: torch.Tensor, img2: torch.Tensor) -> float:
    """Compute LPIPS perceptual distance. Returns value between 0 and 1."""
    if not HAS_LPIPS:
        raise ImportError("LPIPS not installed. Run: pip install lpips torchmetrics")
    lpips_model = LPIPS()
    # LPIPS expects input in range [-1, 1]
    img1_scaled = img1 * 2 - 1
    img2_scaled = img2 * 2 - 1
    distance = lpips_model(img1_scaled, img2_scaled)
    return float(distance.item())


def score_theme(ref_image: str, test_image: str) -> dict:
    """
    Compute quality scores between reference and test images.

    Args:
        ref_image: Path to reference/original screenshot
        test_image: Path to test/adapted screenshot

    Returns:
        dict with ssim_score, lpips_score, and pass/fail status
    """
    config_path = Path(__file__).parent.parent / "config" / "framework-rules.json"
    with open(config_path) as f:
        config = json.load(f)

    thresholds = config["scoring"]
    ssim_threshold = thresholds["ssimThreshold"]
    lpips_threshold = thresholds["lpipsThreshold"]

    ref_tensor = load_image(ref_image)
    test_tensor = load_image(test_image)

    ssim_score = compute_ssim(ref_tensor, test_tensor)

    result = {
        "ssim": round(ssim_score, 4),
        "lpips": None,
        "passed": False,
        "details": {}
    }

    if HAS_LPIPS:
        lpips_score = compute_lpips(ref_tensor, test_tensor)
        result["lpips"] = round(lpips_score, 4)
        result["passed"] = ssim_score >= ssim_threshold and lpips_score <= lpips_threshold
        result["details"] = {
            "ssim_threshold": ssim_threshold,
            "lpips_threshold": lpips_threshold,
            "ssim_pass": ssim_score >= ssim_threshold,
            "lpips_pass": lpips_score <= lpips_threshold
        }
    else:
        result["passed"] = ssim_score >= ssim_threshold
        result["details"] = {
            "ssim_threshold": ssim_threshold,
            "lpips_threshold": lpips_threshold,
            "ssim_pass": ssim_score >= ssim_threshold,
            "lpips_pass": None,
            "warning": "LPIPS not available, only SSIM validation"
        }

    return result


def main():
    parser = argparse.ArgumentParser(description="Theme Clone Quality Scorer")
    parser.add_argument("--ref", required=True, help="Reference image path")
    parser.add_argument("--test", required=True, help="Test image path")
    parser.add_argument("--output", help="Output JSON path (optional)")

    args = parser.parse_args()

    result = score_theme(args.ref, args.test)

    print(json.dumps(result, indent=2))

    if args.output:
        with open(args.output, "w") as f:
            json.dump(result, f, indent=2)

    sys.exit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()