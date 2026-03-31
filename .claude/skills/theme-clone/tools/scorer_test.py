#!/usr/bin/env python3
"""Tests for scorer.py"""

import pytest
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))

from scorer import score_theme


def test_scorer_output_format(tmp_path):
    """Test that scorer returns expected JSON structure with required fields."""
    # Create minimal test images (1x1 pixel PNG)
    from PIL import Image
    import numpy as np

    img1 = Image.new('RGB', (10, 10), color='red')
    img2 = Image.new('RGB', (10, 10), color='red')

    ref_path = tmp_path / "ref.png"
    test_path = tmp_path / "test.png"
    img1.save(ref_path)
    img2.save(test_path)

    # Run scoring
    result = score_theme(str(ref_path), str(test_path))

    # Verify structure
    assert 'ssim' in result
    assert 'lpips' in result
    assert 'passed' in result
    assert 'details' in result
    assert isinstance(result['ssim'], float)
    assert isinstance(result['passed'], bool)

    # Identical images should pass
    assert result['passed'] == True
    assert result['ssim'] == 1.0


def test_config_loading():
    """Test that framework-rules.json loads correctly."""
    config_path = Path(__file__).parent.parent / "config" / "framework-rules.json"
    assert config_path.exists(), "framework-rules.json not found"

    with open(config_path) as f:
        config = json.load(f)

    assert "frameworks" in config
    assert "scoring" in config
    assert "ssimThreshold" in config["scoring"]
    assert "lpipsThreshold" in config["scoring"]
    assert config["scoring"]["ssimThreshold"] == 0.88
    assert config["scoring"]["lpipsThreshold"] == 0.15


if __name__ == "__main__":
    pytest.main([__file__, "-v"])