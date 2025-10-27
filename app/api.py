"""Backend API for fetching paper citations using OpenAlex API."""

import requests
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

OPENALEX_API = "https://api.openalex.org"


def format_paper(work):
    """Format OpenAlex work data to a standard structure.

    Args:
        work: OpenAlex work object

    Returns:
        Formatted paper data
    """
    authors = []
    if work.get("authorships"):
        for authorship in work["authorships"]:
            author = authorship.get("author", {})
            if author and author.get("display_name"):
                authors.append({"name": author["display_name"]})

    # Extract venue/journal information
    venue = None
    primary_location = work.get("primary_location")
    if primary_location and primary_location.get("source"):
        venue = primary_location["source"].get("display_name")

    return {
        "paperId": work.get("id", "").replace("https://openalex.org/", ""),
        "title": work.get("title", "Unknown Title"),
        "authors": authors,
        "year": work.get("publication_year"),
        "citationCount": work.get("cited_by_count", 0),
        "referenceCount": work.get("referenced_works_count", 0),
        "venue": venue
    }


def search_paper(title):
    """Search for a paper by title using OpenAlex API.

    Args:
        title: The paper title to search for

    Returns:
        Paper data including paperId, title, and authors, or None if not found
    """
    url = f"{OPENALEX_API}/works"
    params = {
        "search": title,
        "per_page": 5  # Get top 5 results to find one with references
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        if data.get("results") and len(data["results"]) > 0:
            # Prefer papers that have references
            papers = data["results"]
            for work in papers:
                ref_count = work.get("referenced_works_count", 0)
                if ref_count > 0:
                    paper = format_paper(work)
                    print(f"Found paper: {paper['title']} (ID: {paper['paperId']}, References: {ref_count})")
                    return paper

            # If none have references, return first result
            paper = format_paper(papers[0])
            print(f"Warning: No papers found with references. Using: {paper['title']}")
            return paper
        return None
    except requests.RequestException as e:
        print(f"Error searching for paper: {e}")
        return None


def get_paper_citations(paper_id):
    """Get citations (references) for a paper.

    Args:
        paper_id: OpenAlex work ID

    Returns:
        List of cited papers with their metadata
    """
    # Ensure the ID has the full OpenAlex URL format
    if not paper_id.startswith("http"):
        paper_id = f"https://openalex.org/{paper_id}"

    url = f"{OPENALEX_API}/works/{paper_id.replace('https://openalex.org/', '')}"
    params = {"select": "id,title,authorships,publication_year,cited_by_count,referenced_works"}

    try:
        print(f"Fetching references for paper ID: {paper_id}")
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        work = response.json()

        referenced_works = work.get("referenced_works", [])

        if not referenced_works:
            print(f"No references found for paper {paper_id}")
            return []

        print(f"Found {len(referenced_works)} reference IDs, fetching details...")

        # Fetch details for referenced works (up to 50 at a time due to API limits)
        citations = []
        batch_size = 50

        for i in range(0, min(len(referenced_works), 100), batch_size):
            batch = referenced_works[i:i + batch_size]
            filter_ids = "|".join([ref.replace("https://openalex.org/", "") for ref in batch])

            works_url = f"{OPENALEX_API}/works"
            works_params = {"filter": f"openalex_id:{filter_ids}", "per_page": batch_size}

            batch_response = requests.get(works_url, params=works_params, timeout=10)
            batch_response.raise_for_status()
            batch_data = batch_response.json()

            for result in batch_data.get("results", []):
                citations.append(format_paper(result))

        print(f"Successfully fetched details for {len(citations)} references")
        return citations
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
