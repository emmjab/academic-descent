# Academic Descent

A web application for exploring academic paper citation graphs. Enter a paper title and visualize its citations as an interactive graph, where each node can be clicked to explore deeper into the citation network.

## Features

- Search for academic papers by title
- Visualize citation networks as interactive graphs
- Click on any paper to view its citations
- Hierarchical layout showing citation relationships
- Uses the OpenAlex API for paper data

## Setup

### Prerequisites

- Python 3.9 or higher
- pip

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd academic_descent
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Application

### Development Server

Start the Flask development server:

```bash
python -m app.api
```

The application will be available at http://localhost:5000

### Using the App

1. Enter a paper title in the search box
2. Click "Search" or press Enter
3. The paper and its citations will be displayed as a graph
4. Click on any citation node to explore its citations
5. Use the navigation controls to zoom and pan

## Development

### Project Structure

```
academic_descent/
├── app/
│   ├── __init__.py       # Package initialization
│   ├── api.py            # Flask backend API
│   ├── static/           # Frontend assets
│   │   ├── app.js        # JavaScript application logic
│   │   └── styles.css    # CSS styles
│   └── templates/        # HTML templates
│       └── index.html    # Main page
├── tests/                # Test files
├── requirements.txt      # Python dependencies
├── pyproject.toml        # Project configuration
└── README.md
```

### Code Formatting

Format code with Black:
```bash
black app/ tests/
```

### Linting

Run Flake8:
```bash
flake8 app/ tests/
```

### Testing

Run tests with pytest:
```bash
pytest
```

Run tests with coverage:
```bash
pytest --cov=app tests/
```

## API Endpoints

### GET /api/search

Search for a paper by title.

**Parameters:**
- `title` (string, required): The paper title to search for

**Response:**
```json
{
  "paperId": "...",
  "title": "...",
  "authors": [...],
  "year": 2023,
  "citationCount": 42
}
```

### GET /api/citations/:paperId

Get citations for a specific paper.

**Response:**
```json
{
  "citations": [
    {
      "paperId": "...",
      "title": "...",
      "authors": [...],
      "year": 2022,
      "citationCount": 15
    }
  ]
}
```

## Technologies Used

- **Backend**: Flask (Python web framework)
- **Frontend**: Vanilla JavaScript with vis.js for graph visualization
- **API**: OpenAlex API for paper data (free, no authentication required)
- **Testing**: pytest
- **Code Quality**: Black (formatter), Flake8 (linter)

## License

This project is open source and available under the MIT License.
