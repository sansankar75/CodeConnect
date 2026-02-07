/**
 * Webview Script - FIXED COLORS FOR BLACK BACKGROUND
 * Function names on arrows now VISIBLE + File names readable
 */
(function() {
    const vscode = acquireVsCodeApi();
    
    let cy = null;
    let currentGraphData = null;

    /**
     * Initializes the Cytoscape graph with BLACK BACKGROUND colors
     */
    function initializeGraph() {
        const container = document.getElementById('graph');

        if (!container) {
            console.error('Graph container not found');
            return;
        }

        // Create Cytoscape instance with BLACK THEME
        cy = cytoscape({
            container: container,
            
            style: [
                // Node styles - WHITE TEXT for black background
                {
                    selector: 'node',
                    style: {
                        'label': 'data(label)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'font-size': '12px',
                        'font-weight': 'bold',
                        'color': '#FFFFFF',           // ✅ WHITE TEXT
                        'text-outline-width': 2,
                        'text-outline-color': '#000000', // ✅ BLACK OUTLINE
                        'width': 'label',
                        'height': 'label',
                        'padding': '10px',
                        'shape': 'roundrectangle',
                        'background-color': '#2E2E2E', // ✅ DARK GRAY (not pure black)
                        'border-width': 2,
                        'border-color': '#555555'
                    }
                },
                
                // Folder nodes - ORANGE
                {
                    selector: 'node[type="folder"]',
                    style: {
                        'background-color': '#FF9800',
                        'shape': 'diamond'
                    }
                },
                
                // File nodes - GREEN  
                {
                    selector: 'node[type="file"]',
                    style: {
                        'background-color': '#4CAF50',
                        'shape': 'roundrectangle'
                    }
                },
                
                // Function nodes - BLUE + SMALLER
                {
                    selector: 'node[type="function"]',
                    style: {
                        'background-color': '#2196F3',
                        'shape': 'ellipse',
                        'font-size': '10px',
                        'color': '#FFFFFF'            // ✅ WHITE TEXT
                    }
                },
                
                // ✅ FIXED EDGE LABELS - FUNCTION NAMES ON ARROWS
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#CCCCCC',      // ✅ LIGHT GRAY lines
                        'target-arrow-color': '#CCCCCC',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'arrow-scale': 1.2,
                        'label': 'data(label)',       // Function name on arrow
                        'font-size': '11px',          // ✅ BIGGER function names
                        'font-weight': 'bold',
                        'color': '#FFFFFF',           // ✅ WHITE TEXT for function names
                        'text-outline-width': 1.5,
                        'text-outline-color': '#000000', // ✅ BLACK OUTLINE
                        'text-rotation': 'autorotate',
                        'text-margin-y': -8,          // ✅ CLOSER to arrow
                        'z-index': 10
                    }
                },
                
                // Contains edges (folder -> file)
                {
                    selector: 'edge[type="contains"]',
                    style: {
                        'line-color': '#888888',
                        'target-arrow-color': '#888888',
                        'line-style': 'solid'
                    }
                },
                
                // Import edges - GREEN
                {
                    selector: 'edge[type="imports"]',
                    style: {
                        'line-color': '#4CAF50',
                        'target-arrow-color': '#4CAF50',
                        'line-style': 'dashed',
                        'color': '#FFFFFF'            // ✅ WHITE labels
                    }
                },
                
                // Function call edges - BLUE
                {
                    selector: 'edge[type="calls"]',
                    style: {
                        'line-color': '#2196F3',
                        'target-arrow-color': '#2196F3',
                        'line-style': 'dotted',
                        'color': '#FFFFFF'            // ✅ WHITE labels
                    }
                },
                
                // Selected nodes - GOLD highlight
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': 4,
                        'border-color': '#FFD700',
                        'background-color': '#FF5722'
                    }
                },
                
                // Selected edges - GOLD
                {
                    selector: 'edge:selected',
                    style: {
                        'width': 4,
                        'line-color': '#FFD700',
                        'target-arrow-color': '#FFD700',
                        'color': '#FFD700'            // ✅ GOLD labels
                    }
                },

                // Highlighted nodes/edges
                {
                    selector: '.highlighted',
                    style: {
                        'border-width': 3,
                        'border-color': '#FFD700',
                        'background-opacity': 1,
                        'line-color': '#FFD700 !important',
                        'target-arrow-color': '#FFD700 !important',
                        'color': '#FFD700 !important',  // ✅ GOLD text
                        'font-weight': 'bold'
                    }
                }
            ],
            
            layout: {
                name: 'breadthfirst',
                directed: true,
                padding: 50,
                spacingFactor: 1.5,
                animate: true,
                animationDuration: 500
            },

            minZoom: 0.1,
            maxZoom: 3,
            wheelSensitivity: 0.2,
            
            hideEdgesOnViewport: true,
            textureOnViewport: true,
            pixelRatio: 'auto'
        });

        setupEventHandlers();
        console.log('✅ Cytoscape graph initialized - BLACK THEME');
    }

    // Keep ALL other functions exactly the same...
    function setupEventHandlers() {
        cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            handleNodeClick(node);
        });

        cy.on('dbltap', 'node', function(evt) {
            const node = evt.target;
            cy.animate({
                fit: { eles: node, padding: 100 },
                duration: 500
            });
        });

        cy.on('tap', function(evt) {
            if (evt.target === cy) {
                cy.$('node').removeClass('highlighted');
                cy.$('edge').removeClass('highlighted');
            }
        });

        setupToolbarHandlers();
    }

    function setupToolbarHandlers() {
        const fitBtn = document.getElementById('fitBtn');
        const resetBtn = document.getElementById('resetBtn');

        if (fitBtn) {
            fitBtn.addEventListener('click', () => {
                if (cy) {
                    cy.fit(null, 50);
                    cy.center();
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (cy && currentGraphData) {
                    renderGraph(currentGraphData);
                }
            });
        }
    }

    function handleNodeClick(node) {
        const nodeData = node.data();
        highlightConnected(node);

        vscode.postMessage({
            command: 'nodeClicked',
            data: {
                id: nodeData.id,
                type: nodeData.type,
                label: nodeData.label,
                filePath: nodeData.path,
                line: nodeData.line || 0
            }
        });
    }

    function highlightConnected(node) {
        cy.$('node').removeClass('highlighted');
        cy.$('edge').removeClass('highlighted');
        node.addClass('highlighted');
        const connectedEdges = node.connectedEdges();
        connectedEdges.addClass('highlighted');
        const connectedNodes = connectedEdges.connectedNodes();
        connectedNodes.addClass('highlighted');
    }

    function renderGraph(graphData) {
        if (!cy) initializeGraph();

        if (!graphData || !graphData.nodes || !graphData.edges) {
            showError('Invalid graph data');
            return;
        }

        currentGraphData = graphData;

        try {
            cy.elements().remove();
            cy.add(graphData.nodes);
            cy.add(graphData.edges);

            const layout = cy.layout({
                name: 'breadthfirst',
                directed: true,
                padding: 50,
                spacingFactor: 1.5,
                animate: true,
                animationDuration: 500,
                avoidOverlap: true
            });
            layout.run();

            setTimeout(() => {
                cy.fit(null, 50);
                cy.center();
            }, 600);

            updateStats(graphData.stats);
        } catch (error) {
            showError('Failed to render graph: ' + error.message);
        }
    }

    function updateStats(stats) {
        const statsElement = document.getElementById('stats');
        if (!statsElement || !stats) return;

        const text = `${stats.totalNodes} nodes, ${stats.totalEdges} edges | ` +
                    `Files: ${stats.nodesByType.file || 0}, ` +
                    `Functions: ${stats.nodesByType.function || 0}`;

        statsElement.textContent = text;
        statsElement.style.color = '#FFFFFF';  // ✅ WHITE stats text
    }

    function showError(message) {
        console.error(message);
        const statsElement = document.getElementById('stats');
        if (statsElement) {
            statsElement.textContent = `Error: ${message}`;
            statsElement.style.color = '#FF4444';
        }
    }

    // Listen for messages from extension (unchanged)
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'renderGraph': renderGraph(message.data); break;
            case 'updateGraph': renderGraph(message.data); break;
            default: console.warn('Unknown command:', message.command);
        }
    });

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeGraph();
            vscode.postMessage({ command: 'ready' });
        });
    } else {
        initializeGraph();
        vscode.postMessage({ command: 'ready' });
    }

    window.codeConnect = {
        cy: () => cy,
        renderGraph,
        updateGraph: renderGraph
    };
})();
