# Code Connect - VS Code Extension

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/code-connect/code-connect)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Code Connect** is a powerful VS Code extension that visualizes your codebase structure as an interactive dependency graph. Understand your code architecture at a glance with automatic AST parsing and real-time updates.

![Code Connect Demo](https://via.placeholder.com/800x450?text=Code+Connect+Demo)

## Features

- 🔍 **Automatic Code Analysis**: Scans your workspace and parses JavaScript, TypeScript, and Python files
- 📊 **Interactive Graph Visualization**: View your code structure using Cytoscape.js
- 🔗 **Dependency Tracking**: See imports, exports, and function calls
- 🎯 **Click to Navigate**: Click any node to jump directly to the source code
- 🔄 **Real-time Updates**: File watcher automatically updates the graph when you edit code
- 🎨 **Visual Hierarchy**: Folders, files, and functions displayed with distinct styles
- ⚡ **Performance Optimized**: Handles large codebases efficiently

## Installation

### From VSIX (Development)

1. Clone this repository
2. Install dependencies:
   ```bash
   cd code-connect
   npm install
   ```
3. Press `F5` in VS Code to launch the extension in development mode

### From VS Code Marketplace (Coming Soon)

Search for "Code Connect" in the Extensions view (`Ctrl+Shift+X`)

## Usage

### Opening the Graph

1. Open a workspace folder containing JavaScript, TypeScript, or Python files
2. Run the command: **Code Connect: Show Dependency Graph** (`Ctrl+Shift+P`)
3. Wait for the graph to load (progress shown in notification)

### Interacting with the Graph

- **Click a node**: Jump to the definition in your code
- **Double-click**: Focus on that node and its connections
- **Scroll wheel**: Zoom in/out
- **Click and drag**: Pan around the graph
- **Fit button**: Reset view to show all nodes
- **Reset button**: Re-render the graph with original layout

### Understanding Node Types

- 🔶 **Orange Diamond**: Folder
- 🟢 **Green Rectangle**: File
- 🔵 **Blue Circle**: Function

### Understanding Edge Types

- **Solid Gray**: Contains relationship (folder → file, file → function)
- **Dashed Green**: Import relationship
- **Dotted Blue**: Function call

## Configuration

Open VS Code Settings (`Ctrl+,`) and search for "Code Connect":

### Available Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codeConnect.maxFilesToScan` | 1000 | Maximum number of files to analyze |
| `codeConnect.excludePatterns` | `**/node_modules/**`, etc. | Glob patterns to exclude |
| `codeConnect.includePatterns` | `**/*.js`, `**/*.ts`, `**/*.py` | File patterns to include |

### Example Configuration

```json
{
  "codeConnect.maxFilesToScan": 2000,
  "codeConnect.excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/.git/**"
  ],
  "codeConnect.includePatterns": [
    "**/*.js",
    "**/*.jsx",
    "**/*.ts",
    "**/*.tsx",
    "**/*.py"
  ]
}
```

## Supported Languages

| Language | Features |
|----------|----------|
| **JavaScript** | ✅ Functions, Imports, Exports, Calls |
| **TypeScript** | ✅ Functions, Imports, Exports, Calls |
| **Python** | ✅ Functions, Imports, Calls (exports TBD) |

## Architecture

```
code-connect/
├── src/
│   ├── extension.js      # Main extension entry point
│   ├── scanner.js        # Workspace scanning logic
│   ├── parser.js         # AST parsing (Babel for JS/TS)
│   ├── graph.js          # Graph data structure builder
│   └── watcher.js        # File system change detection
├── resources/
│   ├── webview.js        # Cytoscape graph visualization
│   └── styles.css        # Webview styling
└── package.json          # Extension manifest
```

## How It Works

1. **Scanning**: Discovers all supported files in your workspace
2. **Parsing**: Uses Babel to parse JavaScript/TypeScript into AST
3. **Extraction**: Extracts functions, imports, exports, and calls
4. **Graph Building**: Creates nodes (folders/files/functions) and edges (relationships)
5. **Visualization**: Renders the graph using Cytoscape.js in a webview
6. **Watching**: Monitors file changes and updates the graph automatically

## Commands

| Command | Keyboard Shortcut | Description |
|---------|------------------|-------------|
| `code-connect.showGraph` | - | Show dependency graph |
| `code-connect.refreshGraph` | - | Refresh the current graph |

## Performance Tips

- **Large codebases**: Increase `maxFilesToScan` gradually
- **Slow rendering**: Consider excluding test files or large libraries
- **Memory usage**: Close the graph panel when not in use

## Troubleshooting

### Graph is empty or incomplete

- Check that your files match the `includePatterns`
- Ensure files aren't excluded by `excludePatterns`
- Look for parse errors in the **Developer Tools Console** (`Help > Toggle Developer Tools`)

### Extension not activating

- Ensure you have a workspace folder open
- Check that you have supported files (.js, .ts, .py)
- Reload VS Code (`Developer: Reload Window`)

### Graph is slow to load

- Reduce `maxFilesToScan` in settings
- Add more exclusion patterns (e.g., `**/test/**`, `**/tests/**`)

## Development

### Prerequisites

- Node.js 18+
- VS Code 1.74+

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
# Press F5 in VS Code

# Lint code
npm run lint

# Run tests
npm test
```

### Project Structure

```
src/
  extension.js    → Main activation, commands, webview management
  scanner.js      → File discovery and filtering
  parser.js       → AST parsing with Babel
  graph.js        → Graph data structure creation
  watcher.js      → File system monitoring

resources/
  webview.js      → Cytoscape visualization logic
  styles.css      → UI styling
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Support for more languages (Java, C++, Go, Rust)
- [ ] Export graph as image (PNG, SVG)
- [ ] Search and filter functionality
- [ ] Custom graph layouts (hierarchical, circular)
- [ ] Metrics and analytics (cyclomatic complexity, etc.)
- [ ] Integration with Git (show changes over time)
- [ ] Collaboration features (share graphs)

## Known Issues

- Python parsing is regex-based; complex syntax may not be fully captured
- Very large files (>5000 LOC) may slow down parsing
- Circular dependencies may create complex graph layouts

## License

MIT License - see [LICENSE](LICENSE) file for details

## Credits

- Built with [Cytoscape.js](https://js.cytoscape.org/)
- AST parsing powered by [Babel](https://babeljs.io/)
- Icons from [VS Code Codicons](https://microsoft.github.io/vscode-codicons/)

## Support

- 🐛 Report bugs: [GitHub Issues](https://github.com/code-connect/code-connect/issues)
- 💬 Ask questions: [GitHub Discussions](https://github.com/code-connect/code-connect/discussions)
- 📧 Email: sansankar472@gmail.com

---

**Made with ❤️ for developers who love clean code architecture**
