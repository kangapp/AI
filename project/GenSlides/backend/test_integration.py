import pytest
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from main import app, slides_manager, cost_tracker


@pytest.fixture(autouse=True)
def reset_state():
    """Reset state before each test"""
    slides_manager.slides_dir = Path(tempfile.mkdtemp()) / "slides"
    slides_manager.images_dir = Path(tempfile.mkdtemp()) / "slides/images"
    slides_manager.slides_dir.mkdir(parents=True, exist_ok=True)
    slides_manager.images_dir.mkdir(parents=True, exist_ok=True)
    cost_tracker.reset()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def test_get_empty_slides(client):
    response = client.get("/api/slides")
    assert response.status_code == 200
    data = response.json()
    assert data["slides"] == []
    assert data["title"] == "Untitled"


def test_create_slide(client):
    response = client.post(
        "/api/slides",
        json={"text": "测试幻灯片"},
        params={"slug": "test"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "测试幻灯片"
    assert "sid" in data


def test_update_slide(client):
    # Create
    create_response = client.post(
        "/api/slides",
        json={"text": "原始文字"}
    )
    sid = create_response.json()["sid"]

    # Update
    update_response = client.put(
        f"/api/slides/{sid}",
        json={"text": "新文字"}
    )
    assert update_response.status_code == 200
    assert update_response.json()["text"] == "新文字"


def test_delete_slide(client):
    # Create
    create_response = client.post(
        "/api/slides",
        json={"text": "要删除"}
    )
    sid = create_response.json()["sid"]

    # Delete
    delete_response = client.delete(f"/api/slides/{sid}")
    assert delete_response.status_code == 200

    # Verify
    get_response = client.get("/api/slides")
    assert len(get_response.json()["slides"]) == 0


def test_get_cost(client):
    response = client.get("/api/cost")
    assert response.status_code == 200
    data = response.json()
    assert "gemini_calls" in data
    assert "minimax_calls" in data
    assert "total_cost" in data


def test_playback_endpoint(client):
    # Create some slides
    client.post("/api/slides", json={"text": "Slide 1"})
    client.post("/api/slides", json={"text": "Slide 2"})

    response = client.get("/api/playback/slides")
    assert response.status_code == 200
    data = response.json()
    assert len(data["slides"]) == 2
    assert data["slides"][0]["text"] == "Slide 1"
    assert data["slides"][1]["text"] == "Slide 2"
