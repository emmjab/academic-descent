# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Academic Descent is a web application that visualizes academic paper citation networks. Users can search for a paper by title and explore its citations as an interactive hierarchical graph. The application uses the Semantic Scholar API to fetch paper metadata and citation information.

## Architecture

### Backend (Flask)

The backend is a Flask application located in `app/api.py` that serves both the web interface and REST API:

- **Framework**: Flask with CORS enabled for API access
- **External API**: Semantic Scholar Graph API (`https://api.semanticscholar.org/graph/v1`)
- **Key Functions**:
  - `search_paper(title)`: Searches Semantic Scholar for a paper by title, returns first match
  - `get_paper_citations(paper_id)`: Fetches all references (papers cited by the given paper)

**Important**: The API fetches *references* (papers that are cited), not *citations* (papers that cite this paper). This creates a backward-looking citation graph showing what papers influenced the searched paper.

### Frontend (Vanilla JavaScript + vis.js)

The frontend uses vis.js for network graph visualization:

- **Graph Library**: vis.js Network component with hierarchical layout
- **State Management**: Maintains `nodes` and `edges` DataSets, tracks `loadedPapers` to prevent duplicate expansions
- **Interaction Pattern**: Clicking a node displays its details and lazily loads its citations if not already loaded

**Key Architecture Decision**: Citations are loaded on-demand (when a node is clicked) rather than recursively at search time. This prevents overwhelming the API and provides better UX for large citation networks.

### Data Flow

1. User searches for paper title → `/api/search` → Semantic Scholar search endpoint
2. Root paper added to graph → User clicks node → `/api/citations/:paperId` → Semantic Scholar references endpoint
3. Citations added as child nodes → Process repeats for any clicked node

## Development Commands

### Environment Setup
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Running the Application
```bash
# Start development server (runs on http://localhost:5000)
python -m app.api
```

### Testing
```bash
# Run all tests
pytest

# Run tests with coverage report
pytest --cov=app tests/

# Run specific test file
pytest tests/test_api.py

# Run specific test function
pytest tests/test_api.py::test_search_without_title
```

### Code Quality
```bash
# Format code with Black (line length: 100)
black app/ tests/

# Check code with Black (no changes)
black --check app/ tests/

# Lint with Flake8
flake8 app/ tests/
```

## Important Patterns

### API Error Handling

The Semantic Scholar API calls in `app/api.py` use try-except blocks with 10-second timeouts. Errors are logged to console and return empty/None values rather than raising exceptions. API endpoints return proper HTTP status codes (400 for bad requests, 404 for not found).

### Graph Visualization

The vis.js network uses a hierarchical layout (`direction: 'LR'`) with physics disabled for consistent positioning. The graph is configured in `app/static/app.js:initNetwork()` with specific spacing values (`levelSeparation: 250`, `nodeSpacing: 150`) tuned for readability.

### Node Expansion Tracking

The `loadedPapers` Set prevents redundant API calls when clicking the same node multiple times. This is critical for UX and respecting API rate limits. If you modify citation loading logic, ensure this tracking mechanism is preserved.

## Adding New Features

### Adding a New API Endpoint

1. Add the route handler in `app/api.py`
2. Follow the pattern of returning JSON with proper error handling
3. Add corresponding tests in `tests/test_api.py`
4. Update frontend JavaScript in `app/static/app.js` to call the endpoint

### Modifying the Graph Visualization

The vis.js options are in `app/static/app.js:initNetwork()`. Key configuration areas:
- Node appearance: `options.nodes`
- Edge appearance and arrows: `options.edges`
- Layout algorithm: `options.layout.hierarchical`
- Interactivity: `options.interaction`

### Using a Different Citation API

If switching from Semantic Scholar to another API (CrossRef, OpenAlex, etc.):
1. Update the base URL constant in `app/api.py`
2. Modify `search_paper()` and `get_paper_citations()` to match new API response format
3. Ensure the returned data structure includes: `paperId`, `title`, `authors`, `year`, `citationCount`
4. Update tests to reflect new API behavior

## Semantic Scholar API Notes

- **No authentication required** for basic usage (rate limits apply)
- **Rate Limit**: ~100 requests per 5 minutes for anonymous requests
- **Paper ID Format**: Semantic Scholar paper IDs (not DOIs or arXiv IDs directly)
- **Fields Parameter**: Explicitly specify fields to reduce response size and improve performance
- **Documentation**: https://api.semanticscholar.org/api-docs/graph

The `references` endpoint returns papers that the queried paper *cites*, not papers that cite it (which would be the `citations` endpoint). This distinction is crucial for understanding the graph structure.
