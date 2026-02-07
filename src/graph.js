/**
 * Graph Builder Module
 * 
 * Builds a graph data structure from parsed file data:
 * - Creates nodes for folders, files, and functions
 * - Creates edges for imports and function calls
 * - Organizes data for visualization
 */

const path = require('path');
const vscode = require('vscode');

class GraphBuilder {
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.nodeIdCounter = 0;
        this.nodeMap = new Map(); // Maps unique keys to node IDs
    }

    /**
     * Builds a complete graph from scanned file data
     * 
     * @param {Map<string, Object>} filesMap - Map of file paths to parsed data
     * @returns {Object} Graph data with nodes and edges
     */
    buildGraph(filesMap) {
        this.reset();

        // Convert Map to Array for easier processing
        const files = Array.from(filesMap.values());

        if (files.length === 0) {
            return this.getGraphData();
        }

        // Build folder hierarchy
        this.buildFolderNodes(files);

        // Build file and function nodes
        this.buildFileNodes(files);

        // Build edges for imports and function calls
        this.buildEdges(files);

        return this.getGraphData();
    }

    /**
     * Builds folder nodes from file paths
     * Creates a hierarchy of folders
     * 
     * @param {Array<Object>} files - Array of file data
     */
    buildFolderNodes(files) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) return;

        const folders = new Set();

        // Extract all unique folder paths
        files.forEach(file => {
            let currentPath = path.dirname(file.path);

            // Add all parent folders
            while (currentPath !== workspaceFolder && currentPath !== path.dirname(currentPath)) {
                folders.add(currentPath);
                currentPath = path.dirname(currentPath);
            }
        });

        // Create folder nodes
        folders.forEach(folderPath => {
            const relativePath = path.relative(workspaceFolder, folderPath);
            const folderName = path.basename(folderPath);

            this.addNode({
                id: this.getNodeId('folder', folderPath),
                label: folderName,
                type: 'folder',
                path: folderPath,
                relativePath: relativePath || '.'
            });
        });
    }

    /**
     * Builds file and function nodes
     * 
     * @param {Array<Object>} files - Array of file data
     */
    buildFileNodes(files) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        files.forEach(file => {
            const fileName = path.basename(file.path);
            const relativePath = workspaceFolder 
                ? path.relative(workspaceFolder, file.path)
                : file.path;

            // Create file node
            const fileNodeId = this.addNode({
                id: this.getNodeId('file', file.path),
                label: fileName,
                type: 'file',
                path: file.path,
                relativePath: relativePath,
                language: file.language,
                functionCount: file.functions.length,
                importCount: file.imports.length,
                exportCount: file.exports.length
            });

            // Link file to its parent folder
            const parentFolder = path.dirname(file.path);
            const parentNodeId = this.getNodeId('folder', parentFolder);
            
            if (this.nodeMap.has(`folder:${parentFolder}`)) {
                this.addEdge({
                    source: parentNodeId,
                    target: fileNodeId,
                    type: 'contains',
                    label: ''
                });
            }

            // Create function nodes
            file.functions.forEach(func => {
                const funcNodeId = this.addNode({
                    id: this.getNodeId('function', `${file.path}:${func.name}:${func.line}`),
                    label: func.name,
                    type: 'function',
                    path: file.path,
                    line: func.line,
                    endLine: func.endLine,
                    functionType: func.type,
                    params: func.params || []
                });

                // Link function to its file
                this.addEdge({
                    source: fileNodeId,
                    target: funcNodeId,
                    type: 'contains',
                    label: ''
                });
            });
        });
    }

    /**
     * Builds edges representing imports and function calls
     * 
     * @param {Array<Object>} files - Array of file data
     */
    buildEdges(files) {
        const filePathMap = new Map(files.map(f => [f.path, f]));

        files.forEach(file => {
            const fileNodeId = this.getNodeId('file', file.path);

            // Create import edges
            file.imports.forEach(imp => {
                const targetFileNodeId = this.resolveImportTarget(imp.source, filePathMap);

                if (targetFileNodeId) {
                    this.addEdge({
                        source: fileNodeId,
                        target: targetFileNodeId,
                        type: 'imports',
                        label: imp.imported !== '*' ? imp.imported : ''
                    });
                }
            });

            // Create function call edges
            file.functions.forEach(func => {
                const funcNodeId = this.getNodeId('function', `${file.path}:${func.name}:${func.line}`);

                // Find calls made by this function
                file.calls.forEach(call => {
                    // Check if call is within this function's scope
                    if (call.line >= func.line && call.line <= func.endLine) {
                        // Try to find the called function in the same file
                        const targetFunc = file.functions.find(f => f.name === call.name);

                        if (targetFunc) {
                            const targetFuncNodeId = this.getNodeId(
                                'function',
                                `${file.path}:${targetFunc.name}:${targetFunc.line}`
                            );

                            this.addEdge({
                                source: funcNodeId,
                                target: targetFuncNodeId,
                                type: 'calls',
                                label: ''
                            });
                        }
                    }
                });
            });
        });
    }

    /**
     * Resolves an import source to a file node ID
     * 
     * @param {string} importSource - Import source string
     * @param {Map} filePathMap - Map of file paths to file data
     * @returns {string|null} Node ID or null if not found
     */
    resolveImportTarget(importSource, filePathMap) {
        // Try exact match first
        if (filePathMap.has(importSource)) {
            return this.getNodeId('file', importSource);
        }

        // Try with common extensions
        const extensions = ['.js', '.jsx', '.ts', '.tsx', '.py'];
        for (const ext of extensions) {
            const withExt = importSource + ext;
            if (filePathMap.has(withExt)) {
                return this.getNodeId('file', withExt);
            }

            // Try index files
            const indexPath = path.join(importSource, 'index' + ext);
            if (filePathMap.has(indexPath)) {
                return this.getNodeId('file', indexPath);
            }
        }

        // Try relative path resolution
        for (const [filePath] of filePathMap) {
            if (filePath.endsWith(importSource) || filePath.includes(importSource)) {
                return this.getNodeId('file', filePath);
            }
        }

        return null;
    }

    /**
     * Adds a node to the graph
     * 
     * @param {Object} nodeData - Node data
     * @returns {string} Node ID
     */
    addNode(nodeData) {
        const existingId = this.nodeMap.get(`${nodeData.type}:${nodeData.path || nodeData.id}`);
        
        if (existingId) {
            return existingId;
        }

        const node = {
            data: {
                id: nodeData.id,
                ...nodeData
            }
        };

        this.nodes.push(node);
        this.nodeMap.set(`${nodeData.type}:${nodeData.path || nodeData.id}`, nodeData.id);

        return nodeData.id;
    }

    /**
     * Adds an edge to the graph
     * 
     * @param {Object} edgeData - Edge data
     */
    addEdge(edgeData) {
        // Avoid duplicate edges
        const edgeKey = `${edgeData.source}-${edgeData.target}-${edgeData.type}`;
        
        if (this.edges.some(e => 
            `${e.data.source}-${e.data.target}-${e.data.type}` === edgeKey
        )) {
            return;
        }

        const edge = {
            data: {
                id: `edge-${this.edges.length}`,
                source: edgeData.source,
                target: edgeData.target,
                type: edgeData.type,
                label: edgeData.label || ''
            }
        };

        this.edges.push(edge);
    }

    /**
     * Generates a unique node ID
     * 
     * @param {string} type - Node type
     * @param {string} identifier - Unique identifier
     * @returns {string} Node ID
     */
    getNodeId(type, identifier) {
        const key = `${type}:${identifier}`;
        
        if (this.nodeMap.has(key)) {
            return this.nodeMap.get(key);
        }

        const id = `${type}-${this.nodeIdCounter++}`;
        return id;
    }

    /**
     * Gets the complete graph data
     * 
     * @returns {Object} Graph data with nodes and edges
     */
    getGraphData() {
        return {
            nodes: this.nodes,
            edges: this.edges,
            stats: {
                totalNodes: this.nodes.length,
                totalEdges: this.edges.length,
                nodesByType: this.getNodeCountsByType(),
                edgesByType: this.getEdgeCountsByType()
            }
        };
    }

    /**
     * Counts nodes by type
     * 
     * @returns {Object} Node counts by type
     */
    getNodeCountsByType() {
        const counts = {
            folder: 0,
            file: 0,
            function: 0
        };

        this.nodes.forEach(node => {
            if (counts.hasOwnProperty(node.data.type)) {
                counts[node.data.type]++;
            }
        });

        return counts;
    }

    /**
     * Counts edges by type
     * 
     * @returns {Object} Edge counts by type
     */
    getEdgeCountsByType() {
        const counts = {
            contains: 0,
            imports: 0,
            calls: 0
        };

        this.edges.forEach(edge => {
            if (counts.hasOwnProperty(edge.data.type)) {
                counts[edge.data.type]++;
            }
        });

        return counts;
    }

    /**
     * Resets the graph data
     */
    reset() {
        this.nodes = [];
        this.edges = [];
        this.nodeIdCounter = 0;
        this.nodeMap.clear();
    }

    /**
     * Filters the graph to show only specific node types
     * 
     * @param {Array<string>} types - Node types to include
     * @returns {Object} Filtered graph data
     */
    filterByNodeType(types) {
        const filteredNodes = this.nodes.filter(node => 
            types.includes(node.data.type)
        );

        const nodeIds = new Set(filteredNodes.map(n => n.data.id));

        const filteredEdges = this.edges.filter(edge =>
            nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target)
        );

        return {
            nodes: filteredNodes,
            edges: filteredEdges,
            stats: {
                totalNodes: filteredNodes.length,
                totalEdges: filteredEdges.length
            }
        };
    }
}

module.exports = GraphBuilder;
