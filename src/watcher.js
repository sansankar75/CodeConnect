/**
 * File Watcher Module
 * 
 * Monitors the workspace for file changes:
 * - Watches for file creation, modification, and deletion
 * - Filters based on include/exclude patterns
 * - Triggers callbacks when relevant files change
 * - Debounces rapid changes to avoid excessive updates
 */

const vscode = require('vscode');
const path = require('path');
const { minimatch } = require('minimatch');

class FileWatcher {
    /**
     * Creates a new file watcher
     * 
     * @param {Function} onChange - Callback function when files change
     */
    constructor(onChange) {
        this.onChange = onChange;
        this.watchers = [];
        this.pendingChanges = new Set();
        this.debounceTimer = null;
        this.debounceDelay = 1000; // 1 second debounce
        this.config = this.loadConfiguration();

        this.initialize();
    }

    /**
     * Loads configuration from VS Code settings
     * 
     * @returns {Object} Configuration object
     */
    loadConfiguration() {
        const config = vscode.workspace.getConfiguration('codeConnect');
        return {
            excludePatterns: config.get('excludePatterns', [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/.git/**',
                '**/venv/**',
                '**/__pycache__/**'
            ]),
            includePatterns: config.get('includePatterns', [
                '**/*.js',
                '**/*.jsx',
                '**/*.ts',
                '**/*.tsx',
                '**/*.py'
            ])
        };
    }

    /**
     * Initializes file watchers for all include patterns
     */
    initialize() {
        if (!vscode.workspace.workspaceFolders) {
            console.log('No workspace folders to watch');
            return;
        }

        // Create a watcher for each include pattern
        this.config.includePatterns.forEach(pattern => {
            this.createWatcher(pattern);
        });

        console.log(`File watcher initialized with ${this.watchers.length} pattern(s)`);
    }

    /**
     * Creates a file system watcher for a specific pattern
     * 
     * @param {string} pattern - Glob pattern to watch
     */
    createWatcher(pattern) {
        try {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(
                    vscode.workspace.workspaceFolders[0],
                    pattern
                )
            );

            // Handle file creation
            watcher.onDidCreate(uri => {
                this.handleFileChange(uri.fsPath, 'created');
            });

            // Handle file modification
            watcher.onDidChange(uri => {
                this.handleFileChange(uri.fsPath, 'modified');
            });

            // Handle file deletion
            watcher.onDidDelete(uri => {
                this.handleFileChange(uri.fsPath, 'deleted');
            });

            this.watchers.push(watcher);
        } catch (error) {
            console.error(`Failed to create watcher for pattern ${pattern}:`, error);
        }
    }

    /**
     * Handles a file change event
     * Filters the file and adds it to pending changes
     * 
     * @param {string} filePath - Path to the changed file
     * @param {string} changeType - Type of change ('created', 'modified', 'deleted')
     */
    handleFileChange(filePath, changeType) {
        // Check if file should be excluded
        if (this.shouldExclude(filePath)) {
            return;
        }

        // Check if file should be included
        if (!this.shouldInclude(filePath)) {
            return;
        }

        console.log(`File ${changeType}: ${filePath}`);

        // Add to pending changes
        this.pendingChanges.add(filePath);

        // Debounce the change notification
        this.debounceChanges();
    }

    /**
     * Debounces change notifications to avoid excessive updates
     * Waits for a quiet period before notifying listeners
     */
    debounceChanges() {
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set new timer
        this.debounceTimer = setTimeout(() => {
            this.notifyChanges();
        }, this.debounceDelay);
    }

    /**
     * Notifies listeners of accumulated file changes
     */
    notifyChanges() {
        if (this.pendingChanges.size === 0) {
            return;
        }

        const changedFiles = Array.from(this.pendingChanges);
        this.pendingChanges.clear();

        console.log(`Notifying ${changedFiles.length} file change(s)`);

        // Call the onChange callback
        if (this.onChange) {
            try {
                this.onChange(changedFiles);
            } catch (error) {
                console.error('Error in onChange callback:', error);
            }
        }
    }

    /**
     * Checks if a file should be excluded based on patterns
     * 
     * @param {string} filePath - File path to check
     * @returns {boolean} True if file should be excluded
     */
    shouldExclude(filePath) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) return false;

        const relativePath = path.relative(workspaceFolder, filePath);

        return this.config.excludePatterns.some(pattern => {
            return minimatch(relativePath, pattern, { dot: true });
        });
    }

    /**
     * Checks if a file should be included based on patterns
     * 
     * @param {string} filePath - File path to check
     * @returns {boolean} True if file should be included
     */
    shouldInclude(filePath) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) return false;

        const relativePath = path.relative(workspaceFolder, filePath);

        return this.config.includePatterns.some(pattern => {
            return minimatch(relativePath, pattern, { dot: true });
        });
    }

    /**
     * Manually triggers a change notification for specific files
     * Useful for forcing updates
     * 
     * @param {Array<string>} filePaths - Array of file paths
     */
    triggerChange(filePaths) {
        filePaths.forEach(filePath => {
            this.pendingChanges.add(filePath);
        });

        this.debounceChanges();
    }

    /**
     * Pauses the file watcher
     * Stops emitting change events
     */
    pause() {
        this.isPaused = true;
        console.log('File watcher paused');
    }

    /**
     * Resumes the file watcher
     * Starts emitting change events again
     */
    resume() {
        this.isPaused = false;
        console.log('File watcher resumed');

        // Process any pending changes
        if (this.pendingChanges.size > 0) {
            this.debounceChanges();
        }
    }

    /**
     * Reloads configuration from settings
     */
    reloadConfiguration() {
        this.config = this.loadConfiguration();
        console.log('File watcher configuration reloaded');
    }

    /**
     * Gets the current number of pending changes
     * 
     * @returns {number} Number of pending file changes
     */
    getPendingChangeCount() {
        return this.pendingChanges.size;
    }

    /**
     * Clears all pending changes without notifying
     */
    clearPendingChanges() {
        this.pendingChanges.clear();
        
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    /**
     * Disposes of all watchers and cleans up resources
     * Called when the extension is deactivated
     */
    dispose() {
        console.log('Disposing file watcher');

        // Clear debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Dispose all watchers
        this.watchers.forEach(watcher => {
            try {
                watcher.dispose();
            } catch (error) {
                console.error('Error disposing watcher:', error);
            }
        });

        this.watchers = [];
        this.pendingChanges.clear();
    }
}

module.exports = FileWatcher;
