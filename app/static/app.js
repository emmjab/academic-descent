// Graph state
let network = null;
let nodes = new vis.DataSet([]);
let edges = new vis.DataSet([]);
let expandedPapers = new Set(); // Track which papers are currently expanded
let paperChildren = {}; // Track children of each paper for collapsing
let citationCache = {}; // Cache fetched citation data to avoid re-fetching
let paperOccurrences = {}; // Track how many times each paper appears in the graph
let nodeLevels = {}; // Track the hierarchical level (depth) of each node

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
                forceDirection: 'horizontal'
            }
        },
        layout: {
            hierarchical: {
                direction: 'LR',
                sortMethod: 'directed',
                levelSeparation: 400,
                nodeSpacing: 100
            }
        },
        physics: {
            enabled: false
        },
        interaction: {
            hover: true,
            navigationButtons: true,
            keyboard: true,
            zoomView: true,
            zoomSpeed: 0.5,
            dragView: true
        },
        configure: {
            enabled: false
        }
    };

    network = new vis.Network(container, data, options);

    // Set initial zoom to fit the graph
    network.fit({
        animation: {
            duration: 500,
            easingFunction: 'easeInOutQuad'
        }
    });

    // Add zoom constraints after initialization
    network.on('zoom', function(params) {
        const scale = network.getScale();
        // Prevent zooming out too far (minimum scale of 0.1)
        if (scale < 0.1) {
            network.moveTo({
                scale: 0.1
            });
        }
        // Prevent zooming in too far (maximum scale of 5.0)
        if (scale > 5.0) {
            network.moveTo({
                scale: 5.0
            });
        }
    });

    // Function to check and constrain view bounds
    function checkViewBounds() {
        if (nodes.length === 0) {
            console.log('No nodes, skipping bounds check');
            return;
        }

        try {
            // Calculate bounds manually from node positions
            const positions = network.getPositions();
            const nodeIds = Object.keys(positions);

            if (nodeIds.length === 0) {
                console.log('No node positions available');
                return;
            }

            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;

            nodeIds.forEach(id => {
                const pos = positions[id];
                minX = Math.min(minX, pos.x);
                maxX = Math.max(maxX, pos.x);
                minY = Math.min(minY, pos.y);
                maxY = Math.max(maxY, pos.y);
            });

            // Estimate node dimensions (nodes can be up to 250 wide, ~100 tall)
            const nodeWidth = 150;  // Half-width estimate with margin
            const nodeHeight = 75;  // Half-height estimate with margin

            console.log('Extreme node positions:', { minX, maxX, minY, maxY });

            const viewPosition = network.getViewPosition();
            const scale = network.getScale();
            const canvas = network.canvas.frame.canvas;
            const containerWidth = canvas.clientWidth;
            const containerHeight = canvas.clientHeight;

            // Calculate visible area in graph coordinates
            const visibleWidth = containerWidth / scale;
            const visibleHeight = containerHeight / scale;

            // Calculate viewport edges
            const viewLeft = viewPosition.x - visibleWidth / 2;
            const viewRight = viewPosition.x + visibleWidth / 2;
            const viewTop = viewPosition.y - visibleHeight / 2;
            const viewBottom = viewPosition.y + visibleHeight / 2;

            console.log('View edges:', { viewLeft, viewRight, viewTop, viewBottom });
            console.log('Current view position:', viewPosition);

            // Calculate boundaries to keep at least one edge node visible
            // clampMinX: leftmost node's right edge at viewport's right edge
            // minX + nodeWidth = viewPosition.x + visibleWidth/2
            const clampMinX = minX + nodeWidth - visibleWidth / 2;

            // clampMaxX: rightmost node's left edge at viewport's left edge
            // maxX - nodeWidth = viewPosition.x - visibleWidth/2
            const clampMaxX = maxX - nodeWidth + visibleWidth / 2;

            // Same logic for Y
            const clampMinY = minY + nodeHeight - visibleHeight / 2;
            const clampMaxY = maxY - nodeHeight + visibleHeight / 2;

            console.log('Clamp boundaries:', { clampMinX, clampMaxX, clampMinY, clampMaxY });
            console.log('Viewport width/height:', { visibleWidth, visibleHeight });
            console.log('Node size estimates:', { nodeWidth, nodeHeight });

            // Clamp the current position to stay within boundaries
            let newX = Math.max(clampMinX, Math.min(clampMaxX, viewPosition.x));
            let newY = Math.max(clampMinY, Math.min(clampMaxY, viewPosition.y));

            let needsAdjustment = (newX !== viewPosition.x || newY !== viewPosition.y);

            if (needsAdjustment) {
                console.log('Clamping position from', viewPosition, 'to', { x: newX, y: newY });
                console.log('X clamping:', viewPosition.x, 'between', clampMinX, 'and', clampMaxX);
                console.log('Y clamping:', viewPosition.y, 'between', clampMinY, 'and', clampMaxY);
            } else {
                console.log('No adjustment needed');
            }

            if (needsAdjustment) {
                console.log('Adjusting view to:', { x: newX, y: newY });
                network.moveTo({
                    position: { x: newX, y: newY },
                    scale: scale,
                    animation: false
                });
            } else {
                console.log('No adjustment needed');
            }
        } catch (e) {
            console.error('Error in bounds check:', e);
        }
    }

    // Check bounds after dragging ends
    network.on('dragEnd', function() {
        console.log('dragEnd event fired');
        // Small delay to let vis.js finish updating view position
        setTimeout(checkViewBounds, 10);
    });

    // Check bounds after animation finishes (for navigation buttons)
    network.on('animationFinished', function() {
        console.log('animationFinished event fired');
        setTimeout(checkViewBounds, 10);
    });

    // Also check on release event (backup for canvas dragging)
    network.on('release', function() {
        console.log('release event fired');
        setTimeout(checkViewBounds, 10);
    });

    // Handle node clicks
    network.on('click', function(params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const node = nodes.get(nodeId);
            displayPaperInfo(node);

            // Toggle expand/collapse
            if (expandedPapers.has(nodeId)) {
                // Collapse: remove children
                collapseCitations(nodeId);
            } else {
                // Expand: load citations using the original paper ID
                const actualPaperId = node.paperId || nodeId;
                loadCitations(nodeId, node.title, actualPaperId);
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

    let urlLink = '';
    if (paper.url) {
        urlLink = `<strong>Link:</strong> <a href="${paper.url}" target="_blank" rel="noopener noreferrer">View Paper</a><br>`;
    }

    detailsEl.innerHTML = `
        <div class="paper-title">${paper.title || 'Unknown Title'}</div>
        <p class="paper-meta">
            <strong>Authors:</strong> ${authors}<br>
            <strong>Year:</strong> ${year}<br>
            <strong>Venue:</strong> ${venue}<br>
            <strong>Citations:</strong> ${citationCount}<br>
            ${urlLink}
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
        expandedPapers.clear();
        paperChildren = {};
        citationCache = {};
        paperOccurrences = {};
        nodeLevels = {};

        // Add root node at level 0
        nodes.add({
            id: paper.paperId,
            label: formatNodeLabel(paper),
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            venue: paper.venue,
            citationCount: paper.citationCount,
            url: paper.url || null, // Store paper URL
            paperId: paper.paperId, // Store original paper ID
            level: 0, // Root is at level 0
            color: {
                background: '#667eea',
                border: '#764ba2'
            },
            font: {
                color: '#ffffff',
                align: 'center'
            }
        });

        // Track this as first occurrence and its level
        paperOccurrences[paper.paperId] = 1;
        nodeLevels[paper.paperId] = 0;

        displayPaperInfo(paper);

        // Load citations for the root paper
        await loadCitations(paper.paperId, paper.title);

    } catch (error) {
        console.error('Error:', error);
        showStatus('An error occurred while searching', 'error');
    }
}

// Collapse citations for a paper
function collapseCitations(paperId) {
    const children = paperChildren[paperId] || [];

    // Remove edges from this paper to its children
    const edgesToRemove = edges.get({
        filter: (edge) => edge.from === paperId
    });
    edges.remove(edgesToRemove);

    // Recursively collapse and remove child nodes
    children.forEach(childId => {
        // First collapse any expanded children
        if (expandedPapers.has(childId)) {
            collapseCitations(childId);
        }
        // Then remove the child node
        nodes.remove(childId);
    });

    // Mark as collapsed (but keep children tracking and cache for re-expansion)
    expandedPapers.delete(paperId);

    if (children.length > 0) {
        showStatus(`Collapsed ${children.length} citations`, 'info');
    }
}

// Load citations for a paper
async function loadCitations(nodeId, paperTitle, actualPaperId = null) {
    // Use actualPaperId for API calls, nodeId for tracking expansion state
    const apiPaperId = actualPaperId || nodeId;

    if (expandedPapers.has(nodeId)) {
        return;
    }

    let citations;

    // Check if we have cached data using the actual paper ID
    if (citationCache[apiPaperId]) {
        showStatus(`Showing ${citationCache[apiPaperId].length} cached citations...`, 'info');
        citations = citationCache[apiPaperId];
    } else {
        // Fetch from API
        showStatus(`Loading citations for "${paperTitle}"...`, 'info');

        try {
            const response = await fetch(`/api/citations/${apiPaperId}`);

            if (!response.ok) {
                showStatus('Error loading citations', 'error');
                return;
            }

            const data = await response.json();
            citations = data.citations;

            if (citations.length === 0) {
                showStatus('No citations found for this paper', 'info');
                // Cache empty result so we don't fetch again
                citationCache[apiPaperId] = [];
                expandedPapers.add(nodeId);
                paperChildren[nodeId] = [];
                return;
            }

            // Sort citations by year (oldest to newest, left to right)
            // Papers without years go to the end
            citations.sort((a, b) => {
                const yearA = a.year || 9999;
                const yearB = b.year || 9999;
                return yearA - yearB;
            });

            // Cache the sorted citations
            citationCache[apiPaperId] = citations;

        } catch (error) {
            console.error('Error loading citations:', error);
            console.error('Error details:', error.message, error.stack);
            showStatus(`An error occurred while loading citations: ${error.message}`, 'error');
            return;
        }
    }

    // Track children for this paper
    const childIds = [];

    // Get the parent's level and calculate child level
    const parentLevel = nodeLevels[nodeId] !== undefined ? nodeLevels[nodeId] : 0;
    const childLevel = parentLevel + 1;

    // Add citation nodes and edges
    citations.forEach(citation => {
        // Skip citations with missing required fields
        if (!citation.paperId || !citation.title) {
            console.warn('Skipping citation with missing data:', citation);
            return;
        }

        // Create unique node ID for this parent-child relationship
        const uniqueNodeId = `${nodeId}_${citation.paperId}`;

        // Track if this paper has appeared before
        const occurrenceCount = paperOccurrences[citation.paperId] || 0;
        paperOccurrences[citation.paperId] = occurrenceCount + 1;
        const isDuplicate = occurrenceCount > 0;

        // Determine node color based on whether it's a duplicate
        const nodeColor = isDuplicate
            ? {
                background: '#e0e7ff',  // Lighter shade for duplicates
                border: '#a5b4fc'        // Lighter border
              }
            : {
                background: '#f0f4ff',
                border: '#667eea'
              };

        nodes.add({
            id: uniqueNodeId,
            label: formatNodeLabel(citation),
            title: citation.title || 'Unknown Title',
            authors: citation.authors || [],
            year: citation.year || null,
            venue: citation.venue || null,
            citationCount: citation.citationCount || 0,
            url: citation.url || null, // Store paper URL
            paperId: citation.paperId, // Store original paper ID
            level: childLevel, // Set explicit level based on parent
            color: nodeColor,
            font: {
                align: 'center'
            }
        });

        // Track this child's level
        nodeLevels[uniqueNodeId] = childLevel;

        // Add edge from parent to citation
        const edgeId = `${nodeId}->${uniqueNodeId}`;
        edges.add({
            id: edgeId,
            from: nodeId,
            to: uniqueNodeId
        });

        // Track this child by its unique node ID
        childIds.push(uniqueNodeId);
    });

    // Mark paper as expanded and save its children
    expandedPapers.add(nodeId);
    paperChildren[nodeId] = childIds;

    const statusMsg = citationCache[apiPaperId] && citations.length > 0
        ? `Showing ${citations.length} citations (cached)`
        : `Loaded ${citations.length} citations`;
    showStatus(statusMsg, 'success');

    // Debug: Log graph structure
    console.log(`Added ${childIds.length} children at level ${childLevel} for node ${nodeId} (paper ${apiPaperId}, level ${parentLevel})`);
    console.log('Total nodes:', nodes.length);
    console.log('Total edges:', edges.length);
    console.log('Edges from this node:', edges.get({ filter: (e) => e.from === nodeId }).length);
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
