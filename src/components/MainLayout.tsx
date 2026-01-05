import React, { useState, useRef, useEffect, useCallback } from "react";
import { Layout, Button, Card, Alert, Message, Select, Modal, Input } from "@arco-design/web-react";
import {
  IconPlayCircle,
  IconShareExternal,
  IconCode,
  IconEye,
} from "@arco-design/web-react/icon";
import Editor, { useMonaco } from "@monaco-editor/react";
import type { WebpackModule, WebpackDependency, WebpackBlock, FileMap } from "../utils/webpackCompiler";
import type { editor } from "monaco-editor";
import FileTabBar from "./FileTabBar";
import DependencyLines, { getDepColor } from "./DependencyLines";

const { Sider, Content } = Layout;

export type Stats = {
  modules: WebpackModule[];
};

interface MainLayoutProps {
  onCompile: (files: FileMap) => void;
  stats: Stats | null;
  status: {
    isInitializing: boolean;
    isCompiling: boolean;
    error: string | null;
  };
  initialFiles: FileMap | null;
  mode: 'development' | 'production';
  setMode: (mode: 'development' | 'production') => void;
}

const DEFAULT_CODE = `// Entry point - index.js
import { foo, bar } from './utils.js';
import 'external/lodash';

console.log(foo());
console.log(bar());
`;

const DEFAULT_UTILS = `// utils.js
export * from './lib'
export const bar = () => 42
`;

const DEFAULT_LIB = `// lib.js
export function foo() {
  return 'Hello World!';
}
`;

const DEFAULT_FILES: FileMap = {
  "index.js": DEFAULT_CODE,
  "utils.js": DEFAULT_UTILS,
  "lib.js": DEFAULT_LIB,
};

const MainLayout: React.FC<MainLayoutProps> = ({
  onCompile,
  stats,
  status,
  initialFiles,
  mode,
  setMode,
}) => {
  // Multi-file state
  const [files, setFiles] = useState<FileMap>(() => initialFiles || DEFAULT_FILES);
  const [activeFile, setActiveFile] = useState<string>("index.js");
  const [isDirty, setIsDirty] = useState(false);
  
  // New file modal state
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  // Monaco editor
  const monaco = useMonaco();
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
  const jsonEditorRef = useRef<editor.IStandaloneCodeEditor>(null);
  const decorationsCollectionRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const jsonDecorationsCollectionRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  
  // Refs for line drawing
  const containerRef = useRef<HTMLDivElement>(null);
  const fileTabRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const depItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Lines state
  const [lines, setLines] = useState<Array<{ startX: number; startY: number; endX: number; endY: number; color: string }>>([]); 
  const [showAllActive, setShowAllActive] = useState(false);
  const [hoveredDepIndex, setHoveredDepIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialFiles) {
      setFiles(initialFiles);
    }
  }, [initialFiles]);

  // Clear stats when code changes
  const handleCodeChange = useCallback((value: string | undefined) => {
    const newValue = value || "";
    setFiles(prev => ({ ...prev, [activeFile]: newValue }));
    setIsDirty(true);
    setLines([]); // Clear lines when editing
  }, [activeFile]);

  // When dirty, we hide the stats panel
  useEffect(() => {
    if (isDirty) {
      // Stats will be hidden in render
    }
  }, [isDirty]);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    decorationsCollectionRef.current = editor.createDecorationsCollection();
  };

  const handleJsonEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    jsonEditorRef.current = editor;
    jsonDecorationsCollectionRef.current = editor.createDecorationsCollection();
  };

  // Get the current module (index.js by default for display)
  const currentModule = stats?.modules?.find(m => m.path.includes(activeFile)) || stats?.modules?.find(m => m.path.includes("index.js"));

  // Need this early for useEffect
  const shouldShowStats = stats && !isDirty && !status.isCompiling && !status.isInitializing;

  // Count total deps for color calculation
  const totalDepsCount = currentModule 
    ? currentModule.deps.filter(d => d.targetModule).length 
    : 0;

  // Function to scroll to dependency in JSON editor
  const scrollToDependencyInJson = useCallback((targetDep: WebpackDependency) => {
    if (!jsonEditorRef.current || !stats || !monaco || !currentModule) return;

    const model = jsonEditorRef.current.getModel();
    if (!model) return;

    // Find the module index in the stats.modules array
    const moduleIndex = stats.modules.findIndex(m => m.path === currentModule.path);
    if (moduleIndex === -1) return;

    // Find the dependency index in the module.deps array
    const depIndex = stats.modules[moduleIndex].deps.findIndex(d => d === targetDep); 
    if (depIndex === -1) {
       // If not found in deps, check presentationalDeps or blocks
       // For now, we only handle direct deps as per the current implementation context.
       return; 
    }
    
    // Find the line number of the module's path in the JSON editor
    const modulePathSearchString = `"path": "${currentModule.path}"`;
    const moduleMatches = model.findMatches(modulePathSearchString, true, false, false, null, true);
    if (moduleMatches.length === 0) return;
    
    const moduleStartLine = moduleMatches[0].range.startLineNumber;
    
    // Find the start of the "deps" array within this module
    const depsArraySearchString = `"deps": [`;
    let depsLine = 0;
    for (let i = moduleStartLine; i <= model.getLineCount(); i++) {
        const lineContent = model.getLineContent(i);
        if (lineContent.includes(depsArraySearchString)) {
            depsLine = i;
            break;
        }
    }
    
    if (depsLine === 0) return;
    
    // Now, count '{' characters at the correct indentation level to find the Nth dependency object
    let currentLine = depsLine + 1;
    let objectCount = 0;
    let lineNoToScroll = 0;
    const targetIndentation = model.getLineFirstNonWhitespaceColumn(depsLine + 1); // Indentation of the first item in deps array

    while (currentLine <= model.getLineCount()) {
        const lineContent = model.getLineContent(currentLine);
        const trimmedContent = lineContent.trim();
        const currentIndentation = model.getLineFirstNonWhitespaceColumn(currentLine);

        if (trimmedContent === '],' && currentIndentation < targetIndentation) { // End of deps array
            break;
        }
        
        if (trimmedContent === '{' && currentIndentation === targetIndentation) {
            if (objectCount === depIndex) {
                lineNoToScroll = currentLine;
                break;
            }
            objectCount++;
        }
        currentLine++;
    }
    
    if (lineNoToScroll > 0) {
        jsonEditorRef.current.revealLineInCenter(lineNoToScroll);
        
        // Highlight logic: estimate the number of lines for the dependency object
        const depLines = JSON.stringify(targetDep, null, 2).split('\n').length;
        const exactRange = new monaco.Range(lineNoToScroll, 1, lineNoToScroll + depLines - 1, model.getLineMaxColumn(lineNoToScroll + depLines - 1));
        
        const decoration = {
            range: exactRange,
            options: {
                isWholeLine: true,
                className: 'json-highlight-flash', // CSS class for flashing highlight
            }
        };
        
        const collection = jsonDecorationsCollectionRef.current;
        if (collection) {
            collection.set([decoration]);
            
            // Fade out after a short delay
            setTimeout(() => {
                collection.clear();
            }, 1000);
        }
    }

  }, [stats, currentModule, monaco]);

  // Find which dep is at a given editor position
  const findDepAtPosition = useCallback((lineNumber: number, column: number): { dep: WebpackDependency; index: number; colorIndex: number } | null => {
    if (!currentModule) return null;
    
    let colorIdx = 0;
    for (let i = 0; i < currentModule.deps.length; i++) {
      const dep = currentModule.deps[i];
      if (dep.targetModule) {
        if (dep.loc && "start" in dep.loc && "end" in dep.loc) {
          const loc = dep.loc as { start: { line: number; column: number }; end: { line: number; column: number } };
          if (
            (lineNumber > loc.start.line || (lineNumber === loc.start.line && column >= loc.start.column)) &&
            (lineNumber < loc.end.line || (lineNumber === loc.end.line && column <= loc.end.column + 1))
          ) {
            return { dep, index: i, colorIndex: colorIdx };
          }
        }
        colorIdx++;
      }
    }
    return null;
  }, [currentModule]);

  // Handle editor hover
  const handleEditorHover = useCallback((position: { lineNumber: number; column: number }) => {
    if (showAllActive) return;
    
    const result = findDepAtPosition(position.lineNumber, position.column);
    
    // Always clear previous decorations first when hovering
    if (decorationsCollectionRef.current) {
      decorationsCollectionRef.current.clear();
    }
    
    if (result) {
      setHoveredDepIndex(result.index);
      highlightRange(result.dep, getDepColor(result.colorIndex, totalDepsCount));
      setLines([]);
      drawLineToModule(result.dep, result.colorIndex, totalDepsCount);
    } else {
      setHoveredDepIndex(null);
      setLines([]);
    }
  }, [showAllActive, findDepAtPosition, totalDepsCount]);

  // Add mouse move listener to editor
  useEffect(() => {
    if (!editorRef.current || !shouldShowStats) {
      setHoveredDepIndex(null);
      return;
    }
    
    const editor = editorRef.current;
    const disposable = editor.onMouseMove((e) => {
      if (e.target.position) {
        handleEditorHover(e.target.position);
      }
    });

    const clickDisposable = editor.onMouseDown((e) => {
      if (e.target.position) {
        const result = findDepAtPosition(e.target.position.lineNumber, e.target.position.column);
        if (result) {
          scrollToDependencyInJson(result.dep);
        }
      }
    });
    
    const leaveDisposable = editor.onMouseLeave(() => {
      if (!showAllActive) {
        setHoveredDepIndex(null);
        if (decorationsCollectionRef.current) {
          decorationsCollectionRef.current.clear();
        }
        setLines([]);
      }
    });
    
    return () => {
      disposable.dispose();
      clickDisposable.dispose();
      leaveDisposable.dispose();
    };
  }, [handleEditorHover, showAllActive, shouldShowStats, findDepAtPosition, scrollToDependencyInJson]);

  const highlightRange = (dep: WebpackDependency | WebpackBlock, color?: string) => {
    if (!editorRef.current || !monaco || !dep.loc) return;

    if (!("start" in dep.loc) || !("end" in dep.loc)) {
      return;
    }

    const { start, end } = dep.loc as {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };

    const range = new monaco.Range(
      start.line,
      start.column + 1,
      end.line,
      end.column + 1
    );

    if (decorationsCollectionRef.current) {
      const decorations = decorationsCollectionRef.current.getRanges().length > 0 
        ? [...Array.from({ length: decorationsCollectionRef.current.getRanges().length })].map((_, i) => ({
            range: decorationsCollectionRef.current!.getRanges()[i],
            options: { className: "highlighted-code" }
          }))
        : [];
      
      decorationsCollectionRef.current.set([
        ...decorations,
        {
          range,
          options: {
            className: color ? `dep-highlight-${color.replace(/[^a-zA-Z0-9]/g, '')}` : "highlighted-code",
          },
        },
      ]);

      // Inject dynamic CSS for colored borders
      if (color) {
        const styleId = `dep-style-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
            .dep-highlight-${color.replace(/[^a-zA-Z0-9]/g, '')} {
              border: 1px solid ${color} !important;
              background-color: ${color}22 !important;
              border-radius: 2px;
            }
          `;
          document.head.appendChild(style);
        }
      }
    }
  };

  // Highlight multiple deps with their colors
  const highlightMultipleDeps = useCallback((deps: Array<{ dep: WebpackDependency; color: string }>) => {
    if (!editorRef.current || !monaco) return;
    if (!decorationsCollectionRef.current) return;

    const decorations = deps.map(({ dep, color }) => {
      if (!dep.loc || !("start" in dep.loc) || !("end" in dep.loc)) return null;

      const { start, end } = dep.loc as {
        start: { line: number; column: number };
        end: { line: number; column: number };
      };

      const range = new monaco.Range(
        start.line,
        start.column + 1,
        end.line,
        end.column + 1
      );

      // Inject dynamic CSS for colored borders
      const styleId = `dep-style-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .dep-highlight-${color.replace(/[^a-zA-Z0-9]/g, '')} {
            border: 1px solid ${color} !important;
            background-color: ${color}22 !important;
            border-radius: 2px;
          }
        `;
        document.head.appendChild(style);
      }

      return {
        range,
        options: {
          className: `dep-highlight-${color.replace(/[^a-zA-Z0-9]/g, '')}`,
        },
      };
    }).filter(Boolean) as Array<{ range: any; options: any }>;

    decorationsCollectionRef.current.set(decorations);
  }, [monaco]);

  const clearHighlight = () => {
    if (showAllActive) return; // Don't clear if showing all
    if (!editorRef.current) return;
    if (decorationsCollectionRef.current) {
      decorationsCollectionRef.current.clear();
    }
    setLines([]);
  };

  const clearAllHighlights = () => {
    if (!editorRef.current) return;
    if (decorationsCollectionRef.current) {
      decorationsCollectionRef.current.clear();
    }
    setLines([]);
    setShowAllActive(false);
  };

  // Calculate and draw line from source highlight to target module tab
  const drawLineToModule = useCallback((dep: WebpackDependency, colorIndex: number, totalDeps: number) => {
    if (!dep.loc || !dep.targetModule || !editorRef.current || !monaco) return;

    const loc = dep.loc as { start: { line: number; column: number }; end: { line: number; column: number } };
    
    // Get editor coordinates for the highlighted range
    const editorDom = editorRef.current.getDomNode();
    if (!editorDom) return;

    // Get the position in the editor (start)
    const startPosition = { lineNumber: loc.start.line, column: loc.start.column + 1 };
    const startCoords = editorRef.current.getScrolledVisiblePosition(startPosition);
    if (!startCoords) return;

    // Get the position in the editor (end)
    // If multiline, we just use the end of the first line to determine 'middle' of the start segment,
    // or arguably just the start point if it's too complex. 
    // For now, let's try to get the end of the range.
    const endPosition = { 
      lineNumber: loc.end.line, 
      column: loc.end.column + 1 
    };
    
    // If it's a multiline import, we just take the width of the first line segment or clamp to something reasonable.
    // But usually imports are on one line or we care about the specifier. 
    // Let's just calculate midX based on the range on the start line.
    
    // let endColumn = loc.end.column + 1;
    // if (loc.end.line > loc.start.line) {
    //    endColumn = loc.start.column + 1 + 10; 
    // }

    const effectivelyEndCoords = (loc.end.line === loc.start.line) ? 
        editorRef.current.getScrolledVisiblePosition(endPosition) : 
        startCoords;

    const editorRect = editorDom.getBoundingClientRect();
    
    // Calculate middle X
    // If we have valid end coords on the same line, use them.
    let startX = editorRect.left + startCoords.left;
    if (effectivelyEndCoords) {
        startX = editorRect.left + (startCoords.left + effectivelyEndCoords.left) / 2;
    }
    
    // Start Y is the top of the line
    const startY = editorRect.top + startCoords.top; 

    // Find target module filename
    const targetPath = dep.targetModule;
    
    // Try to match with file tabs
    const matchedFile = Object.keys(fileTabRefs.current).find(f => targetPath.includes(f));
    if (matchedFile && fileTabRefs.current[matchedFile]) {
      const tabRect = fileTabRefs.current[matchedFile]!.getBoundingClientRect();
      const endX = tabRect.left + tabRect.width / 2;
      const endY = tabRect.top + tabRect.height / 2;
      const color = getDepColor(colorIndex, totalDeps);

      setLines(prev => [...prev, { startX, startY, endX, endY, color }]);
    }
  }, [monaco]);

  // Show all dependency lines at once
  const showAllDependencyLines = useCallback(() => {
    if (!currentModule || !editorRef.current || !monaco) return;

    const depsWithTarget = currentModule.deps.filter(d => d.targetModule);
    const total = depsWithTarget.length;
    
    // Clear existing
    setLines([]);
    
    // Prepare all lines and highlights
    const newLines: Array<{ startX: number; startY: number; endX: number; endY: number; color: string }> = [];
    const highlightData: Array<{ dep: WebpackDependency; color: string }> = [];
    
    depsWithTarget.forEach((dep, idx) => {
      if (!dep.loc || !dep.targetModule) return;
      
      const color = getDepColor(idx, total);
      highlightData.push({ dep, color });
      
      const loc = dep.loc as { start: { line: number; column: number }; end: { line: number; column: number } };
      const editorDom = editorRef.current?.getDomNode();
      if (!editorDom) return;

      const startPosition = { lineNumber: loc.start.line, column: loc.start.column + 1 };
      const startCoords = editorRef.current?.getScrolledVisiblePosition(startPosition);
      if (!startCoords) return;

        // Calculate end coords for centering
        let endColumn = loc.end.column + 1;
        let effectiveEndCoords = null;
        
        if (loc.end.line === loc.start.line) {
             effectiveEndCoords = editorRef.current?.getScrolledVisiblePosition({
                lineNumber: loc.end.line,
                column: endColumn
            });
        }
        
        const editorRect = editorDom.getBoundingClientRect();
        
        let startX = editorRect.left + startCoords.left;
        if (effectiveEndCoords) {
             startX = editorRect.left + (startCoords.left + effectiveEndCoords.left) / 2;
        }

       // Top of the span
      const startY = editorRect.top + startCoords.top;

      const targetPath = dep.targetModule;
      const matchedFile = Object.keys(fileTabRefs.current).find(f => targetPath.includes(f));
      
      if (matchedFile && fileTabRefs.current[matchedFile]) {
        const tabRect = fileTabRefs.current[matchedFile]!.getBoundingClientRect();
        const endX = tabRect.left + tabRect.width / 2;
        const endY = tabRect.top + tabRect.height / 2;
        newLines.push({ startX, startY, endX, endY, color });
      }
    });

    highlightMultipleDeps(highlightData);
    setLines(newLines);
    setShowAllActive(true);
  }, [currentModule, monaco, highlightMultipleDeps]);

  const handleDepHover = (dep: WebpackDependency, colorIndex: number, totalDeps: number) => {
    if (showAllActive) return; // Don't change if showing all
    highlightRange(dep, getDepColor(colorIndex, totalDeps));
    setLines([]); // Clear previous lines
    drawLineToModule(dep, colorIndex, totalDeps);
  };

  const handleCompileClick = () => {
    setIsDirty(false);
    onCompile(files);
  };

  // File management
  const handleAddFile = () => {
    setShowNewFileModal(true);
    setNewFileName("");
  };

  const handleCreateFile = () => {
    let filename = newFileName.trim();
    if (!filename) return;
    
    if (!filename.endsWith('.js')) {
      filename += '.js';
    }
    
    if (files[filename]) {
      Message.error('File already exists');
      return;
    }

    setFiles(prev => ({ ...prev, [filename]: `// ${filename}\n` }));
    setActiveFile(filename);
    setShowNewFileModal(false);
    setIsDirty(true);
  };

  const handleDeleteFile = (filename: string) => {
    if (filename === "index.js") return;
    
    const newFiles = { ...files };
    delete newFiles[filename];
    setFiles(newFiles);
    
    if (activeFile === filename) {
      setActiveFile("index.js");
    }
    setIsDirty(true);
  };

  const fileList = Object.keys(files);
  // shouldShowStats already defined above for useEffect, just reuse or reassign here if needed

  // Count total deps for color distribution (used in render)
  const totalDeps = currentModule 
    ? currentModule.deps.filter(d => d.targetModule).length 
    : 0;
  let colorIndex = 0;

  // Check if a dep item should be highlighted from editor hover
  const isDepHighlightedFromEditor = (depIdx: number) => hoveredDepIndex === depIdx;

  return (
    <div ref={containerRef} style={{ height: "100vh", position: "relative" }}>
      <DependencyLines lines={lines} containerRef={containerRef} />
      
      <Layout style={{ height: "100vh", background: "#141414" }}>
        <Sider
          width={600}
          theme="dark"
          style={{ padding: "20px", borderRight: "1px solid #30363d" }}
        >
          <FileTabBar
            files={fileList}
            activeFile={activeFile}
            onSelectFile={setActiveFile}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
            fileTabRefs={fileTabRefs}
          />
          <div style={{ height: "calc(100% - 100px)" }}>
            <Editor
              height="100%"
              defaultLanguage="javascript"
              value={files[activeFile] || ""}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              theme="vs-dark"
              path={activeFile}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                lineNumbers: "on",
              }}
            />
          </div>
          <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
            <Select
              value={mode}
              onChange={setMode}
              style={{ width: 150 }}
              disabled={status.isCompiling || status.isInitializing}
            >
              <Select.Option value="development">Development</Select.Option>
              <Select.Option value="production">Production</Select.Option>
            </Select>
            <Button
              type="primary"
              icon={<IconPlayCircle />}
              onClick={handleCompileClick}
              disabled={status.isCompiling || status.isInitializing}
            >
              {status.isCompiling
                ? "Analyzing..."
                : status.isInitializing
                ? "Initializing..."
                : "Analyze"}
            </Button>
            <Button
              icon={<IconShareExternal />}
              onClick={() => {
                // Encode all files as JSON
                const filesJson = JSON.stringify(files);
                const encodedFiles = encodeURIComponent(btoa(unescape(encodeURIComponent(filesJson))));
                const params = new URLSearchParams();
                params.set('files', encodedFiles);
                params.set('mode', mode);
                window.location.hash = params.toString();
                navigator.clipboard.writeText(window.location.href);
                Message.success("Url copied");
              }}
            >
              Copy Share Link
            </Button>
            {shouldShowStats && (
              <Button
                icon={<IconEye />}
                onClick={showAllActive ? clearAllHighlights : showAllDependencyLines}
                type={showAllActive ? "primary" : "secondary"}
              >
                {showAllActive ? "Hide All" : "Show All"}
              </Button>
            )}
          </div>
        </Sider>
        
        <Content
          style={{
            padding: "20px",
            overflow: "auto",
            width: "calc(100% - 1000px)",
          }}
        >
          <div
            style={{
              background: "#141414",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {status.isInitializing && (
              <Alert content="Initializing WebContainer..." type="info" icon />
            )}
            {status.isCompiling && (
              <Alert content="Webpack compiling..." type="info" icon />
            )}
            {status.error && (
              <Alert
                title="Compile Error"
                content={status.error}
                type="error"
                icon
              />
            )}
            {isDirty && !status.isCompiling && !status.isInitializing && (
              <Alert content="Code has been modified. Click Analyze to see dependencies." type="warning" icon />
            )}
            {!shouldShowStats ? (
              !status.isInitializing && !status.isCompiling && !status.error && !isDirty && (
                <div style={{ color: "#666" }}>Click Analyze to start</div>
              )
            ) : currentModule ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <Card title={`Dependencies - ${activeFile}`}>
                  {currentModule.deps.map((dep, idx) => {
                    const depKey = `dep-${idx}`;
                    const currentColorIndex = dep.targetModule ? colorIndex++ : -1;
                    const depColor = dep.targetModule ? getDepColor(currentColorIndex, totalDeps) : undefined;
                    
                    return (
                      <div
                        key={depKey}
                        ref={(el) => { depItemRefs.current[depKey] = el; }}
                        onMouseEnter={() => handleDepHover(dep, currentColorIndex, totalDeps)}
                        onMouseLeave={clearHighlight}
                        className={`dependency-item ${isDepHighlightedFromEditor(idx) ? 'dep-item-active' : ''}`}
                        style={{
                          cursor: "pointer",
                          padding: "8px",
                          borderBottom: "1px solid #30363d",
                          borderLeft: depColor ? `3px solid ${depColor}` : undefined,
                          backgroundColor: isDepHighlightedFromEditor(idx) ? `${depColor}33` : undefined,
                          transition: 'background-color 0.15s ease',
                        }}
                        onClick={() => scrollToDependencyInJson(dep)}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ color: "#e6e6e6" }}>{dep.type}</span>
                          {dep.targetModule && (
                            <span style={{ 
                              color: depColor, 
                              fontSize: "12px",
                              marginLeft: "8px",
                            }}>
                              → {dep.targetModule.split('/').pop()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </Card>
                
                <Card title="Presentational Dependencies">
                  {currentModule.presentationalDeps.map((dep, idx) => {
                    const depKey = `pres-${idx}`;
                    return (
                      <div
                        key={depKey}
                        onMouseEnter={() => highlightRange(dep)}
                        onMouseLeave={clearHighlight}
                        className="dependency-item"
                        style={{
                          cursor: "pointer",
                          padding: "8px",
                          borderBottom: "1px solid #30363d",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ color: "#e6e6e6" }}>{dep.type}</span>
                        </div>
                      </div>
                    );
                  })}
                </Card>
                
                <Card title="Blocks">
                  {currentModule.blocks.map((block, idx) => {
                    const blockKey = `block-${idx}`;
                    return (
                      <div
                        key={blockKey}
                        className="dependency-item"
                        style={{
                          cursor: "pointer",
                          padding: "8px",
                          borderBottom: "1px solid #30363d",
                        }}
                        onMouseEnter={() => highlightRange(block)}
                        onMouseLeave={clearHighlight}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ color: "#e6e6e6" }}>
                            Async Dependency Block
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            ) : (
              <div style={{ color: "#666" }}>No module data for {activeFile}</div>
            )}
          </div>
        </Content>
        
        <Sider
          width={400}
          theme="dark"
          style={{ padding: "20px", borderLeft: "1px solid #303030" }}
        >
          {shouldShowStats && (
            <Card
              title={
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <IconCode />
                  <span>JSON</span>
                </div>
              }
              style={{
                height: "100%",
                background: "#1f1f1f",
                color: "#fff",
                borderColor: "#303030",
                display: "flex",
                flexDirection: "column",
              }}
              bodyStyle={{
                flex: 1,
                overflow: "hidden",
                padding: "10px", // Reduced padding
              }}
            >
              <div style={{ height: "100%" }}>
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={JSON.stringify(stats, null, 2)}
                  theme="vs-dark"
                  onMount={handleJsonEditorDidMount}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    lineNumbers: "off",
                    folding: true,
                  }}
                />
              </div>
            </Card>
          )}
        </Sider>
      </Layout>
      
      <Modal
        title="Create New File"
        visible={showNewFileModal}
        onOk={handleCreateFile}
        onCancel={() => setShowNewFileModal(false)}
        autoFocus={false}
        focusLock={true}
      >
        <Input
          placeholder="filename.js"
          value={newFileName}
          onChange={setNewFileName}
          onPressEnter={handleCreateFile}
        />
      </Modal>
    </div>
  );
};

export default MainLayout;
