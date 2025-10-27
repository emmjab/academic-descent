"""Backend API for fetching paper citations using Semantic Scholar API."""

import os
import requests
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1"
SEMANTIC_SCHOLAR_API_KEY = os.environ.get("SEMANTIC_SCHOLAR_API_KEY")


def get_headers():
    """Get request headers with optional API key."""
    headers = {}
    if SEMANTIC_SCHOLAR_API_KEY:
        headers["x-api-key"] = SEMANTIC_SCHOLAR_API_KEY
    return headers


def search_paper(title):
    """Search for a paper by title using Semantic Scholar API.

    Args:
        title: The paper title to search for

    Returns:
        Paper data including paperId, title, and authors, or None if not found
    """
    url = f"{SEMANTIC_SCHOLAR_API}/paper/search"
    params = {
        "query": title,
        "limit": 1,
        "fields": "paperId,title,authors,year,citationCount"
    }

    try:
        response = requests.get(url, params=params, headers=get_headers(), timeout=10)
        response.raise_for_status()
        data = response.json()

        if data.get("data") and len(data["data"]) > 0:
            return data["data"][0]
        return None
    except requests.HTTPError as e:
        if e.response.status_code == 429:
            print("Rate limit exceeded. Consider getting a free API key from Semantic Scholar.")
        print(f"Error searching for paper: {e}")
        return None
    except requests.RequestException as e:
        print(f"Error searching for paper: {e}")
        return None


def get_paper_citations(paper_id):
    """Get citations (references) for a paper.

    Args:
        paper_id: Semantic Scholar paper ID

    Returns:
        List of cited papers with their metadata
    """
    url = f"{SEMANTIC_SCHOLAR_API}/paper/{paper_id}/references"
    params = {
        "fields": "paperId,title,authors,year,citationCount",
        "limit": 100
    }

    try:
        response = requests.get(url, params=params, headers=get_headers(), timeout=10)
        response.raise_for_status()
        data = response.json()

        # Extract the cited papers from the response
        citations = []
        for item in data.get("data", []):
            cited_paper = item.get("citedPaper")
            if cited_paper:
                citations.append(cited_paper)

        return citations
    except requests.HTTPError as e:
        if e.response.status_code == 429:
            print("Rate limit exceeded. Consider getting a free API key from Semantic Scholar.")
        print(f"Error fetching citations: {e}")
        return []
    except requests.RequestException as e:
        print(f"Error fetching citations: {e}")
        return []


@app.route("/")
def index():
    """Serve the main page."""
    return render_template("index.html")


@app.route("/api/search", methods=["GET"])
def search():
    """API endpoint to search for a paper by title."""
    title = request.args.get("title", "").strip()

    if not title:
        return jsonify({"error": "Title parameter is required"}), 400

    paper = search_paper(title)

    if not paper:
        return jsonify({"error": "Paper not found"}), 404

    return jsonify(paper)


@app.route("/api/citations/<paper_id>", methods=["GET"])
def citations(paper_id):
    """API endpoint to get citations for a paper."""
    citations_list = get_paper_citations(paper_id)
    return jsonify({"citations": citations_list})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
