/**
 * Code Connect - Main Extension Entry Point
 * 
 * This file handles:
 * - Extension activation and deactivation
 * - Command registration
 * - Webview panel lifecycle management
 * - Communication between extension and webview
 */

const vscode = require('vscode');
const path = require('path');
const Scanner = require('./scanner');
const GraphBuilder = require('./graph');
const FileWatcher = require('./watcher');

let currentPanel = undefined;
let scanner = null;
let graphBuilder = null;
let fileWatcher = null;

/**
 * Activates the extension when VS Code loads it
 * Registers commands and initializes core services
 * 
 * @param {vscode.ExtensionContext} context - Extension context provided by VS Code
 */
async function activate(context) {
    console.log('Code Connect extension is now active');

    // Initialize scanner and graph builder
    scanner = new Scanner();
    graphBuilder = new GraphBuilder();

    // Register the "Show Graph" command
    const showGraphCommand = vscode.commands.registerCommand(
        'code-connect.showGraph',
        async () => {
            await showDependencyGraph(context);
        }
    );

    // Register the "Refresh Graph" command
    const refreshGraphCommand = vscode.commands.registerCommand(
        'code-connect.refreshGraph',
        async () => {
            if (currentPanel) {
                await refreshGraph(currentPanel);
            } else {
                vscode.window.showInformationMessage('Please open the graph first');
            }
        }
    );

    context.subscriptions.push(showGraphCommand, refreshGraphCommand);

    // Initialize file watcher after a short delay to avoid startup slowdown
    setTimeout(() => {
        initializeFileWatcher(context);
    }, 2000);
}

/**
 * Initializes the file watcher to monitor workspace changes
 * Updates the graph automatically when files are modified
 * 
 * @param {vscode.ExtensionContext} context - Extension context
 */
function initializeFileWatcher(context) {
    if (!vscode.workspace.workspaceFolders) {
        return;
    }

    fileWatcher = new FileWatcher((changedFiles) => {
        // Update graph when files change
        if (currentPanel) {
            handleFileChanges(changedFiles);
        }
    });

    context.subscriptions.push(fileWatcher);
}

/**
 * Handles file changes detected by the file watcher
 * Re-scans changed files and updates the graph incrementally
 * 
 * @param {Array<string>} changedFiles - Array of file paths that changed
 */
async function handleFileChanges(changedFiles) {
    try {
        // Re-scan the changed files
        for (const filePath of changedFiles) {
            await scanner.scanFile(filePath);
        }

        // Rebuild the graph with updated data
        const graphData = graphBuilder.buildGraph(scanner.getFiles());

        // Send update to webview
        if (currentPanel) {
            currentPanel.webview.postMessage({
                command: 'updateGraph',
                data: graphData
            });
        }
    } catch (error) {
        console.error('Error handling file changes:', error);
    }
}

/**
 * Shows the dependency graph in a webview panel
 * Scans the workspace if needed and displays the visualization
 * 
 * @param {vscode.ExtensionContext} context - Extension context
 */
async function showDependencyGraph(context) {
    const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

    if (currentPanel) {
        // If panel already exists, reveal it
        currentPanel.reveal(columnToShowIn);
        return;
    }

    // Create and show a new webview panel
    currentPanel = vscode.window.createWebviewPanel(
        'codeConnectGraph',
        'Code Dependency Graph',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, 'resources'))
            ]
        }
    );

    // Set the webview's HTML content
    currentPanel.webview.html = getWebviewContent(currentPanel.webview, context);

    // Handle messages from the webview
    currentPanel.webview.onDidReceiveMessage(
        async (message) => {
            await handleWebviewMessage(message);
        },
        undefined,
        context.subscriptions
    );

    // Clean up when panel is closed
    currentPanel.onDidDispose(
        () => {
            currentPanel = undefined;
        },
        null,
        context.subscriptions
    );

    // Show progress and scan workspace
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Code Connect',
            cancellable: false
        },
        async (progress) => {
            progress.report({ message: 'Scanning workspace...' });

            try {
                // Scan the entire workspace
                await scanner.scanWorkspace();

                progress.report({ message: 'Building dependency graph...' });

                // Build the graph from scanned data
                const graphData = graphBuilder.buildGraph(scanner.getFiles());

                // Send graph data to webview
                currentPanel.webview.postMessage({
                    command: 'renderGraph',
                    data: graphData
                });

                progress.report({ message: 'Complete!' });
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to build graph: ${error.message}`
                );
                console.error('Graph building error:', error);
            }
        }
    );
}

/**
 * Refreshes the graph by re-scanning the workspace
 * 
 * @param {vscode.WebviewPanel} panel - The webview panel to update
 */
async function refreshGraph(panel) {
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Refreshing graph...',
            cancellable: false
        },
        async (progress) => {
            try {
                // Clear existing data
                scanner.clear();

                progress.report({ message: 'Scanning workspace...' });

                // Re-scan workspace
                await scanner.scanWorkspace();

                progress.report({ message: 'Building graph...' });

                // Rebuild graph
                const graphData = graphBuilder.buildGraph(scanner.getFiles());

                // Update webview
                panel.webview.postMessage({
                    command: 'renderGraph',
                    data: graphData
                });

                vscode.window.showInformationMessage('Graph refreshed successfully');
            } catch (error) {
                vscode.window.showErrorMessage(`Refresh failed: ${error.message}`);
                console.error('Refresh error:', error);
            }
        }
    );
}

/**
 * Handles messages received from the webview
 * Processes user interactions like node clicks
 * 
 * @param {Object} message - Message object from webview
 */
async function handleWebviewMessage(message) {
    switch (message.command) {
        case 'nodeClicked':
            await handleNodeClick(message.data);
            break;

        case 'ready':
            // Webview is ready, can send initial data if needed
            console.log('Webview is ready');
            break;

        case 'error':
            vscode.window.showErrorMessage(`Webview error: ${message.message}`);
            break;

        default:
            console.warn('Unknown message from webview:', message);
    }
}

/**
 * Handles when a user clicks a node in the graph
 * Opens the corresponding file and jumps to the definition
 * 
 * @param {Object} nodeData - Data about the clicked node
 */
async function handleNodeClick(nodeData) {
    try {
        const { type, filePath, line } = nodeData;

        if (!filePath) {
            return;
        }

        // Open the file
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document, {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: false
        });

        // Jump to the specific line if provided
        if (line !== undefined && line >= 0) {
            const position = new vscode.Position(line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
        console.error('Node click error:', error);
    }
}

/**
 * Generates the HTML content for the webview
 * Includes the graph visualization and controls
 * 
 * @param {vscode.Webview} webview - The webview instance
 * @param {vscode.ExtensionContext} context - Extension context
 * @returns {string} HTML content for the webview
 */
function getWebviewContent(webview, context) {
    // Create URIs for resources
    const styleUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, 'resources', 'styles.css'))
    );

    const scriptUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, 'resources', 'webview.js'))
    );

    // Generate nonce for Content Security Policy
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" 
          content="default-src 'none'; 
                   style-src ${webview.cspSource} 'unsafe-inline'; 
                   script-src 'nonce-${nonce}' https://unpkg.com;
                   img-src ${webview.cspSource} https:;">
    <title>Code Dependency Graph</title>
    <link href="${styleUri}" rel="stylesheet">
    <script src="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"></script>
</head>
<body>
    <div id="container">
        <div id="toolbar">
            <h2>Code Dependency Graph</h2>
            <div id="controls">
                <button id="fitBtn" title="Fit to screen">
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <path fill="currentColor" d="M3 3v4h1V4h3V3H3zm9 0v1h3v3h1V3h-4zM3 9v4h4v-1H4V9H3zm10 0v3h-3v1h4V9h-1z"/>
                    </svg>
                    Fit
                </button>
                <button id="resetBtn" title="Reset view">
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <path fill="currentColor" d="M12.5 8a4.5 4.5 0 0 1-4.5 4.5c-1.57 0-2.93-.82-3.71-2.04l.94-.66A3.5 3.5 0 1 0 4.5 8H3a5 5 0 1 1 1.17-3.23l.67.94A4.5 4.5 0 0 1 12.5 8z"/>
                    </svg>
                    Reset
                </button>
                <span id="stats">Loading...</span>
            </div>
        </div>
        <div id="graph"></div>
        <div id="legend">
            <div class="legend-item">
                <span class="legend-color" style="background: #4CAF50;"></span>
                <span>File</span>
            </div>
            <div class="legend-item">
                <span class="legend-color" style="background: #2196F3;"></span>
                <span>Function</span>
            </div>
            <div class="legend-item">
                <span class="legend-color" style="background: #FF9800;"></span>
                <span>Folder</span>
            </div>
        </div>
    </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

/**
 * Generates a random nonce for Content Security Policy
 * 
 * @returns {string} Random nonce string
 */
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Deactivates the extension
 * Cleans up resources and subscriptions
 */
function deactivate() {
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    if (scanner) {
        scanner.clear();
    }
    console.log('Code Connect extension deactivated');
}

module.exports = {
    activate,
    deactivate
};
