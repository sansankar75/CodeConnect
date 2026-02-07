/**
 * Parser Module
 * 
 * Handles AST (Abstract Syntax Tree) parsing for:
 * - JavaScript/JSX
 * - TypeScript/TSX
 * - Python
 * 
 * Extracts:
 * - Function definitions (name, location, parameters)
 * - Import statements
 * - Export statements
 * - Function calls and relationships
 */

const babel = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const path = require('path');

class Parser {
    constructor() {
        this.supportedLanguages = ['javascript', 'typescript', 'python'];
    }

    /**
     * Main parse method that routes to language-specific parsers
     * 
     * @param {string} filePath - Absolute path to the file
     * @param {string} content - File content
     * @param {string} language - Programming language
     * @returns {Object} Parsed file data
     */
    async parse(filePath, content, language) {
        if (!this.supportedLanguages.includes(language)) {
            throw new Error(`Unsupported language: ${language}`);
        }

        try {
            let result;

            if (language === 'javascript' || language === 'typescript') {
                result = this.parseJavaScript(filePath, content, language);
            } else if (language === 'python') {
                result = this.parsePython(filePath, content);
            }

            return result;
        } catch (error) {
            console.error(`Parse error in ${filePath}:`, error.message);
            // Return minimal data structure on parse failure
            return this.createEmptyFileData(filePath, language);
        }
    }

    /**
     * Parses JavaScript or TypeScript files using Babel
     * 
     * @param {string} filePath - File path
     * @param {string} content - File content
     * @param {string} language - 'javascript' or 'typescript'
     * @returns {Object} Parsed file data
     */
    parseJavaScript(filePath, content, language) {
        const fileData = this.createEmptyFileData(filePath, language);

        try {
            // Parse with Babel
            const ast = babel.parse(content, {
                sourceType: 'module',
                plugins: [
                    'jsx',
                    'typescript',
                    'decorators-legacy',
                    'classProperties',
                    'dynamicImport',
                    'exportDefaultFrom',
                    'exportNamespaceFrom',
                    'objectRestSpread',
                    'optionalChaining',
                    'nullishCoalescingOperator'
                ],
                errorRecovery: true
            });

            // Traverse the AST to extract information
            traverse(ast, {
                // Extract function declarations
                FunctionDeclaration: (nodePath) => {
                    this.extractFunction(nodePath, fileData, 'function');
                },

                // Extract arrow functions assigned to variables
                VariableDeclarator: (nodePath) => {
                    if (nodePath.node.init && 
                        (nodePath.node.init.type === 'ArrowFunctionExpression' ||
                         nodePath.node.init.type === 'FunctionExpression')) {
                        this.extractFunction(nodePath, fileData, 'variable');
                    }
                },

                // Extract class methods
                ClassMethod: (nodePath) => {
                    this.extractFunction(nodePath, fileData, 'method');
                },

                // Extract imports
                ImportDeclaration: (nodePath) => {
                    this.extractImport(nodePath, fileData, filePath);
                },

                // Extract exports
                ExportNamedDeclaration: (nodePath) => {
                    this.extractExport(nodePath, fileData, 'named');
                },

                ExportDefaultDeclaration: (nodePath) => {
                    this.extractExport(nodePath, fileData, 'default');
                },

                // Extract function calls
                CallExpression: (nodePath) => {
                    this.extractFunctionCall(nodePath, fileData);
                }
            });

        } catch (error) {
            console.error(`Babel parse error in ${filePath}:`, error.message);
        }

        return fileData;
    }

    /**
     * Parses Python files using regex-based extraction
     * (Note: For production, consider using a Python AST parser via child process)
     * 
     * @param {string} filePath - File path
     * @param {string} content - File content
     * @returns {Object} Parsed file data
     */
    parsePython(filePath, content) {
        const fileData = this.createEmptyFileData(filePath, 'python');

        try {
            const lines = content.split('\n');

            // Extract function definitions
            const functionRegex = /^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;
            let match;

            while ((match = functionRegex.exec(content)) !== null) {
                const functionName = match[1];
                const startLine = content.substring(0, match.index).split('\n').length - 1;

                fileData.functions.push({
                    name: functionName,
                    type: 'function',
                    line: startLine,
                    endLine: this.findPythonFunctionEnd(lines, startLine),
                    params: this.extractPythonParams(match[0])
                });
            }

            // Extract imports
            const importRegex = /^\s*(?:from\s+([\w.]+)\s+)?import\s+(.+?)(?:\s+as\s+\w+)?$/gm;

            while ((match = importRegex.exec(content)) !== null) {
                const fromModule = match[1];
                const importedItems = match[2].split(',').map(s => s.trim());

                importedItems.forEach(item => {
                    fileData.imports.push({
                        source: fromModule || item,
                        imported: fromModule ? item : '*',
                        line: content.substring(0, match.index).split('\n').length - 1
                    });
                });
            }

            // Extract function calls (simplified)
            const callRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;

            while ((match = callRegex.exec(content)) !== null) {
                const calledFunction = match[1];
                const line = content.substring(0, match.index).split('\n').length - 1;

                // Avoid built-in functions and keywords
                const builtins = ['print', 'len', 'range', 'str', 'int', 'list', 'dict', 'set'];
                if (!builtins.includes(calledFunction)) {
                    fileData.calls.push({
                        name: calledFunction,
                        line: line
                    });
                }
            }

        } catch (error) {
            console.error(`Python parse error in ${filePath}:`, error.message);
        }

        return fileData;
    }

    /**
     * Finds the end line of a Python function definition
     * 
     * @param {Array<string>} lines - File lines
     * @param {number} startLine - Function start line
     * @returns {number} End line number
     */
    findPythonFunctionEnd(lines, startLine) {
        const indentMatch = lines[startLine].match(/^(\s*)/);
        const baseIndent = indentMatch ? indentMatch[1].length : 0;

        for (let i = startLine + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') continue;

            const lineIndent = line.match(/^(\s*)/)[1].length;
            if (lineIndent <= baseIndent && line.trim().length > 0) {
                return i - 1;
            }
        }

        return lines.length - 1;
    }

    /**
     * Extracts parameters from a Python function definition
     * 
     * @param {string} defLine - The function definition line
     * @returns {Array<string>} Parameter names
     */
    extractPythonParams(defLine) {
        const paramsMatch = defLine.match(/\(([^)]*)\)/);
        if (!paramsMatch || !paramsMatch[1]) return [];

        return paramsMatch[1]
            .split(',')
            .map(p => p.trim().split('=')[0].trim())
            .filter(p => p && p !== 'self' && p !== 'cls');
    }

    /**
     * Extracts function information from AST node
     * 
     * @param {Object} nodePath - Babel node path
     * @param {Object} fileData - File data object to populate
     * @param {string} functionType - Type of function
     */
    extractFunction(nodePath, fileData, functionType) {
        const node = nodePath.node;
        let functionName = 'anonymous';

        if (functionType === 'function' && node.id) {
            functionName = node.id.name;
        } else if (functionType === 'variable' && node.id) {
            functionName = node.id.name;
        } else if (functionType === 'method' && node.key) {
            functionName = node.key.name || node.key.value;
        }

        const functionInfo = {
            name: functionName,
            type: functionType,
            line: node.loc ? node.loc.start.line - 1 : 0,
            endLine: node.loc ? node.loc.end.line - 1 : 0,
            params: this.extractParams(node)
        };

        fileData.functions.push(functionInfo);
    }

    /**
     * Extracts function parameters from a node
     * 
     * @param {Object} node - AST node
     * @returns {Array<string>} Parameter names
     */
    extractParams(node) {
        let params = [];

        // For variable declarators, get params from the init function
        if (node.type === 'VariableDeclarator' && node.init) {
            params = node.init.params || [];
        } else {
            params = node.params || [];
        }

        return params.map(param => {
            if (param.type === 'Identifier') {
                return param.name;
            } else if (param.type === 'RestElement') {
                return '...' + param.argument.name;
            } else if (param.type === 'AssignmentPattern') {
                return param.left.name;
            }
            return 'unknown';
        });
    }

    /**
     * Extracts import information from AST node
     * 
     * @param {Object} nodePath - Babel node path
     * @param {Object} fileData - File data object
     * @param {string} currentFile - Current file path for resolving relative imports
     */
    extractImport(nodePath, fileData, currentFile) {
        const node = nodePath.node;
        const source = node.source.value;

        // Resolve relative import paths
        let resolvedSource = source;
        if (source.startsWith('.')) {
            const currentDir = path.dirname(currentFile);
            resolvedSource = path.resolve(currentDir, source);
        }

        node.specifiers.forEach(spec => {
            let imported = '*';

            if (spec.type === 'ImportSpecifier') {
                imported = spec.imported.name;
            } else if (spec.type === 'ImportDefaultSpecifier') {
                imported = 'default';
            } else if (spec.type === 'ImportNamespaceSpecifier') {
                imported = '*';
            }

            fileData.imports.push({
                source: resolvedSource,
                imported: imported,
                local: spec.local.name,
                line: node.loc ? node.loc.start.line - 1 : 0
            });
        });
    }

    /**
     * Extracts export information from AST node
     * 
     * @param {Object} nodePath - Babel node path
     * @param {Object} fileData - File data object
     * @param {string} exportType - 'named' or 'default'
     */
    extractExport(nodePath, fileData, exportType) {
        const node = nodePath.node;

        if (exportType === 'default') {
            fileData.exports.push({
                name: 'default',
                type: 'default',
                line: node.loc ? node.loc.start.line - 1 : 0
            });
        } else {
            // Named exports
            if (node.declaration) {
                if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
                    fileData.exports.push({
                        name: node.declaration.id.name,
                        type: 'function',
                        line: node.loc ? node.loc.start.line - 1 : 0
                    });
                } else if (node.declaration.type === 'VariableDeclaration') {
                    node.declaration.declarations.forEach(decl => {
                        if (decl.id && decl.id.name) {
                            fileData.exports.push({
                                name: decl.id.name,
                                type: 'variable',
                                line: node.loc ? node.loc.start.line - 1 : 0
                            });
                        }
                    });
                }
            }

            if (node.specifiers) {
                node.specifiers.forEach(spec => {
                    fileData.exports.push({
                        name: spec.exported.name,
                        type: 'named',
                        line: node.loc ? node.loc.start.line - 1 : 0
                    });
                });
            }
        }
    }

    /**
     * Extracts function call information from AST node
     * 
     * @param {Object} nodePath - Babel node path
     * @param {Object} fileData - File data object
     */
    extractFunctionCall(nodePath, fileData) {
        const node = nodePath.node;
        let calledName = 'unknown';

        if (node.callee.type === 'Identifier') {
            calledName = node.callee.name;
        } else if (node.callee.type === 'MemberExpression') {
            if (node.callee.property && node.callee.property.name) {
                calledName = node.callee.property.name;
            }
        }

        fileData.calls.push({
            name: calledName,
            line: node.loc ? node.loc.start.line - 1 : 0
        });
    }

    /**
     * Creates an empty file data structure
     * 
     * @param {string} filePath - File path
     * @param {string} language - Programming language
     * @returns {Object} Empty file data object
     */
    createEmptyFileData(filePath, language) {
        return {
            path: filePath,
            language: language,
            functions: [],
            imports: [],
            exports: [],
            calls: []
        };
    }
}

module.exports = Parser;
