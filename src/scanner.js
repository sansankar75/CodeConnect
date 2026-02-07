/**
 * Scanner Module - FINAL VERSION
 * Excludes ALL Python package folders + lib/scripts + detects real project files
 */
const vscode = require("vscode");
const path = require("path");
const { minimatch } = require("minimatch");
const Parser = require("./parser");

class Scanner {
  constructor() {
    this.files = new Map();
    this.parser = new Parser();
    this.config = this.loadConfiguration();
  }

  loadConfiguration() {
    return {
      maxFiles: 50000,
      excludePatterns: [
        // Core Python package folders (ALSO for py execution)
        "**/lib/**", "**/site-packages/**", "**/dist-packages/**",
        "**/__pycache__/**", "**/venv/**", "**/.venv/**", "**/env/**",
        
        // JS package folders
        "**/node_modules/**", "**/bower_components/**",
        
        // Build/output folders
        "**/dist/**", "**/build/**", "**/.git/**", "**/out/**",
        "**/.next/**", "**/.cache/**", "**/coverage/**",
        
        // Common junk
        "**/.env*", "**/*.log", "**/.idea/**", "**/.vscode/**",
        "**/__tests__/**", "**/test/**", "**/tests/**",
        "**/*.test.*", "**/*.spec.*", "**/*.min.*"
      ],
      includePatterns: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx", "**/*.py"]
    };
  }

  reloadConfiguration() {
    this.config = this.loadConfiguration();
  }

  async scanWorkspace() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) throw new Error("No workspace folder open.");

    console.log("🚀 Smart scan - skipping ALL package folders...");
    this.clear();
    this.reloadConfiguration();

    // Find source files with PROPER exclusion FIRST
    const sourceFiles = await vscode.workspace.findFiles(
      "**/*.{js,jsx,ts,tsx,py}",
      `{${this.config.excludePatterns.join(",")}}`
    );

    console.log(`📁 Raw source files found: ${sourceFiles.length}`);

    // EXTRA Python package folder filter
    const realProjectFiles = sourceFiles.filter(file => {
      const relPath = vscode.workspace.asRelativePath(file.fsPath, true);
      
      // Block Python stdlib/package folders
      const pythonPackages = [
        'lib', 'site-packages', 'dist-packages', 'stdlib', 
        'collections', 'encodings', 'json', 'os', 'sys'
      ];
      
      // Block common package dirs
      const packageDirs = [
        'node_modules', 'lib', 'scripts', 'static', 'public',
        'vendor', 'bower_components', 'dist', 'build'
      ];
      
      const pathSegments = relPath.split('/');
      
      // Check if any package folder is in path
      if (packageDirs.some(dir => pathSegments.includes(dir))) {
        return false;
      }
      
      // Block test files
      if (/\b(test|spec|example)\b/i.test(relPath)) return false;
      
      return true;
    });

    console.log(`✅ Real project files: ${realProjectFiles.length}`);
    
    // Scan only real files
    for (const file of realProjectFiles.slice(0, this.config.maxFiles)) {
      try {
        await this.scanFile(file.fsPath);
      } catch (err) {
        console.error(`❌ ${path.basename(file.fsPath)}:`, err.message);
      }
    }

    const stats = this.getStats();
    console.log(`✅ SCAN COMPLETE: ${this.files.size} files`);
    console.log(`📊 Python: ${stats.byLanguage.python || 0}`);
  }

  async scanFile(filePath) {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const content = doc.getText();
    const language = this.getLanguageFromPath(filePath);

    if (!language) return;

    const parsed = await this.parser.parse(filePath, content, language);
    if (!parsed) return;

    this.files.set(filePath, parsed);
  }

  getLanguageFromPath(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      ".js": "javascript", ".jsx": "javascript",
      ".ts": "typescript", ".tsx": "typescript",
      ".py": "python"
    };
    return map[ext] || null;
  }

  getStats() {
    const stats = {
      totalFiles: this.files.size, totalFunctions: 0,
      totalImports: 0, totalExports: 0,
      byLanguage: { javascript: 0, typescript: 0, python: 0 }
    };

    for (const file of this.files.values()) {
      stats.totalFunctions += (file.functions?.length || 0);
      stats.totalImports += (file.imports?.length || 0);
      stats.totalExports += (file.exports?.length || 0);
      if (stats.byLanguage[file.language] !== undefined) {
        stats.byLanguage[file.language]++;
      }
    }
    return stats;
  }

  clear() { this.files.clear(); }
  getFiles() { return this.files; }
  getFile(path) { return this.files.get(path); }
}

module.exports = Scanner;
