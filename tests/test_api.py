"""Tests for the API module."""

import pytest
from app.api import app


@pytest.fixture
def client():
    """Create a test client for the Flask app."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_index_route(client):
    """Test that the index route returns the main page."""
    response = client.get('/')
    assert response.status_code == 200


def test_search_without_title(client):
    """Test search endpoint without a title parameter."""
    response = client.get('/api/search')
    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data


def test_search_with_empty_title(client):
    """Test search endpoint with an empty title."""
    response = client.get('/api/search?title=')
    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data


def test_citations_route_exists(client):
    """Test that the citations endpoint exists."""
    # Using a fake paper ID - should return empty or handle gracefully
    response = client.get('/api/citations/fakeid123')
    assert response.status_code == 200
    data = response.get_json()
    assert 'citations' in data
