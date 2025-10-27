// Graph state
let network = null;
let nodes = new vis.DataSet([]);
let edges = new vis.DataSet([]);
let loadedPapers = new Set(); // Track which papers we've loaded to avoid duplicates

// Initialize the network graph
function initNetwork() {
    const container = document.getElementById('network-container');
    const data = { nodes, edges };
    const options = {
        nodes: {
            shape: 'box',
            margin: 10,
            widthConstraint: {
                maximum: 250
            },
            font: {
                size: 12,
                color: '#333',
                multi: true
            },
            color: {
                border: '#667eea',
                background: '#f0f4ff',
                highlight: {
                    border: '#764ba2',
                    background: '#e0e7ff'
                }
            }
        },
        edges: {
            arrows: 'to',
            color: {
                color: '#999',
                highlight: '#667eea'
            },
            smooth: {
                type: 'cubicBezier',
                forceDirection: 'vertical'
            }
        },
        layout: {
            hierarchical: {
                direction: 'UD',
                sortMethod: 'directed',
                levelSeparation: 200,
                nodeSpacing: 150
            }
        },
        physics: {
            enabled: false
        },
        interaction: {
            hover: true,
            navigationButtons: true,
            keyboard: true
        }
    };

    network = new vis.Network(container, data, options);

    // Handle node clicks
    network.on('click', function(params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const node = nodes.get(nodeId);
            displayPaperInfo(node);

            // If this paper hasn't been expanded yet, load its citations
            if (!loadedPapers.has(nodeId)) {
                loadCitations(nodeId, node.title);
            }
        }
    });
}

// Display status message
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = type;
    statusEl.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

// Display paper information
function displayPaperInfo(paper) {
    const detailsEl = document.getElementById('paper-details');
    const authors = paper.authors && paper.authors.length > 0
        ? paper.authors.map(a => a.name).join(', ')
        : 'Unknown';
    const year = paper.year || 'Unknown';
    const venue = paper.venue || 'Unknown';
    const citationCount = paper.citationCount !== undefined && paper.citationCount !== null
        ? paper.citationCount
        : 'Unknown';

    detailsEl.innerHTML = `
        <div class="paper-title">${paper.title || 'Unknown Title'}</div>
        <p class="paper-meta">
            <strong>Authors:</strong> ${authors}<br>
            <strong>Year:</strong> ${year}<br>
            <strong>Venue:</strong> ${venue}<br>
            <strong>Citations:</strong> ${citationCount}
        </p>
    `;
}

// Search for a paper
async function searchPaper() {
    const title = document.getElementById('paper-title').value.trim();

    if (!title) {
        showStatus('Please enter a paper title', 'error');
        return;
    }

    showStatus('Searching for paper...', 'info');

    try {
        const response = await fetch(`/api/search?title=${encodeURIComponent(title)}`);

        if (!response.ok) {
            const error = await response.json();
            showStatus(error.error || 'Paper not found', 'error');
            return;
        }

        const paper = await response.json();
        showStatus('Paper found! Loading citations...', 'success');

        // Clear existing graph
        nodes.clear();
        edges.clear();
        loadedPapers.clear();

        // Add root node
        nodes.add({
            id: paper.paperId,
            label: formatNodeLabel(paper),
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            venue: paper.venue,
            citationCount: paper.citationCount,
            color: {
                background: '#667eea',
                border: '#764ba2'
            },
            font: {
                color: '#ffffff',
                align: 'center'
            }
        });

        displayPaperInfo(paper);

        // Load citations for the root paper
        await loadCitations(paper.paperId, paper.title);

    } catch (error) {
        console.error('Error:', error);
        showStatus('An error occurred while searching', 'error');
    }
}

// Load citations for a paper
async function loadCitations(paperId, paperTitle) {
    if (loadedPapers.has(paperId)) {
        return;
    }

    loadedPapers.add(paperId);
    showStatus(`Loading citations for "${paperTitle}"...`, 'info');

    try {
        const response = await fetch(`/api/citations/${paperId}`);

        if (!response.ok) {
            showStatus('Error loading citations', 'error');
            return;
        }

        const data = await response.json();
        let citations = data.citations;

        if (citations.length === 0) {
            showStatus('No citations found for this paper', 'info');
            return;
        }

        // Sort citations by year (oldest to newest, left to right)
        // Papers without years go to the end
        citations.sort((a, b) => {
            const yearA = a.year || 9999;
            const yearB = b.year || 9999;
            return yearA - yearB;
        });

        // Add citation nodes and edges
        citations.forEach(citation => {
            // Skip citations with missing required fields
            if (!citation.paperId || !citation.title) {
                console.warn('Skipping citation with missing data:', citation);
                return;
            }

            if (!nodes.get(citation.paperId)) {
                nodes.add({
                    id: citation.paperId,
                    label: formatNodeLabel(citation),
                    title: citation.title || 'Unknown Title',
                    authors: citation.authors || [],
                    year: citation.year || null,
                    venue: citation.venue || null,
                    citationCount: citation.citationCount || 0,
                    font: {
                        align: 'center'
                    }
                });
            }

            // Add edge from parent to citation
            edges.add({
                from: paperId,
                to: citation.paperId
            });
        });

        showStatus(`Loaded ${citations.length} citations`, 'success');

    } catch (error) {
        console.error('Error loading citations:', error);
        console.error('Error details:', error.message, error.stack);
        showStatus(`An error occurred while loading citations: ${error.message}`, 'error');
    }
}

// Utility function to truncate text
function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}

// Format node label with title, year, and venue
function formatNodeLabel(paper) {
    const title = truncateText(paper.title || 'Unknown Title', 50);
    const year = paper.year ? `(${paper.year})` : '';
    const venue = paper.venue ? truncateText(paper.venue, 40) : '';

    let label = `<b>${title}</b>`;
    if (year) {
        label += `\n${year}`;
    }
    if (venue) {
        label += `\n<i>${venue}</i>`;
    }
    return label;
}

// Event listeners
document.getElementById('search-btn').addEventListener('click', searchPaper);
document.getElementById('paper-title').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchPaper();
    }
});

// Initialize network on page load
window.addEventListener('load', initNetwork);
