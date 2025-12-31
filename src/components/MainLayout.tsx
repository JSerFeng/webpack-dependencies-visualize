import React, { useState, useRef, useEffect } from "react";
import { Layout, Button, Card, Alert, Message, Select } from "@arco-design/web-react";
import {
  IconPlayCircle,
  IconDown,
  IconUp,
  IconShareExternal,
  IconCode,
} from "@arco-design/web-react/icon";
import Editor, { useMonaco } from "@monaco-editor/react";
import type { WebpackDependency, WebpackBlock } from "../utils/webpackCompiler";
import type { editor } from "monaco-editor";

const { Sider, Content } = Layout;

export type Stats = {
  deps: WebpackDependency[];
  presentationalDeps: WebpackDependency[];
  blocks: WebpackBlock[];
};
interface MainLayoutProps {
  onCompile: (code: string) => void;
  stats: Stats;
  status: {
    isInitializing: boolean;
    isCompiling: boolean;
    error: string | null;
  };
  initialCode: string;
  mode: 'development' | 'production';
  setMode: (mode: 'development' | 'production') => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  onCompile,
  stats,
  status,
  initialCode,
  mode,
  setMode,
}) => {
  const [code, setCode] = useState<string>(initialCode);

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);
  const [expandedDeps, setExpandedDeps] = useState<Record<number, boolean>>({});
  const [hoveredItemIndex, setHoveredItemIndex] = useState<number | null>(null);
  const monaco = useMonaco();
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
  const decorationsCollectionRef =
    useRef<editor.IEditorDecorationsCollection | null>(null);

  const toggleExpand = (idx: number) => {
    setExpandedDeps((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleCodeChange = (value: string | undefined) => {
    setCode(value || "");
  };

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    decorationsCollectionRef.current = editor.createDecorationsCollection();
  };

  const highlightRange = (dep: WebpackDependency | WebpackBlock) => {
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
      decorationsCollectionRef.current.set([
        {
          range,
          options: {
            inlineClassName: "highlighted-code",
            className: "highlighted-code",
          },
        },
      ]);
    }
  };

  const clearHighlight = () => {
    if (!editorRef.current) return;
    if (decorationsCollectionRef.current) {
      decorationsCollectionRef.current.clear();
    }
  };

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const handler = (e: any) => {
      const position = e.target.position;
      if (!position || !stats) return;

      const allItems = [
        ...stats.deps,
        ...stats.presentationalDeps,
        ...stats.blocks,
      ];
      const hoveredItemIndex = allItems.findIndex((item) => {
        if (!item.loc || !("start" in item.loc) || !("end" in item.loc))
          return false;
        const { start, end } = item.loc as {
          start: { line: number; column: number };
          end: { line: number; column: number };
        };
        return (
          position.lineNumber >= start.line &&
          position.lineNumber <= end.line &&
          position.column >= start.column &&
          position.column <= end.column
        );
      });

      if (hoveredItemIndex !== -1) {
        setHoveredItemIndex(hoveredItemIndex);
        highlightRange(allItems[hoveredItemIndex]);
      } else {
        setHoveredItemIndex(null);
        clearHighlight();
      }
    };
    const dispose = editorRef.current.onMouseMove(handler);

    return () => {
      dispose.dispose();
    };
  }, [stats]);

  return (
    <Layout style={{ height: "100vh", background: "#141414" }}>
      <Sider
        width={600}
        theme="dark"
        style={{ padding: "20px", borderRight: "1px solid #303030" }}
      >
        <div style={{ height: "calc(100% - 50px)" }}>
          <Editor
            height="100%"
            defaultLanguage="javascript"
            value={code}
            onChange={handleCodeChange}
            onMount={handleEditorDidMount}
            theme="vs-dark"
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
            onClick={() => onCompile(code)}
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
              const encodedCode = encodeURIComponent(btoa(code));
              window.location.hash = `#code=${encodedCode}`;
              navigator.clipboard.writeText(window.location.href);
              Message.success("Url copied");
            }}
          >
            Copy Share Link
          </Button>
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
          {status.isCompiling || status.isInitializing ? (
            ""
          ) : stats ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <Card
                title="Dependencies"
              >
                {stats.deps.map((dep, idx) => {
                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => highlightRange(dep)}
                      onMouseLeave={clearHighlight}
                      className={`dependency-item ${
                        idx === hoveredItemIndex ? "highlighted-code" : ""
                      }`}
                      style={{
                        cursor: "pointer",
                        padding: "8px",
                        borderBottom: "1px solid #303030",
                      }}
                      onClick={() => toggleExpand(idx)}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: "#e6e6e6" }}>{dep.type}</span>
                        {expandedDeps[idx] ? (
                          <IconUp style={{ marginLeft: 8 }} />
                        ) : (
                          <IconDown style={{ marginLeft: 8 }} />
                        )}
                      </div>
                      {expandedDeps[idx] && dep.ids && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px",
                            background: "#141414",
                            borderRadius: "4px",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "bold",
                              marginBottom: "4px",
                              color: "#e6e6e6",
                            }}
                          >
                            ids:
                          </div>
                          <div style={{ display: "flex", color: "#e6e6e6" }}>
                            {dep.ids.join(", ")}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
              <Card
                title="Presentational Dependencies"
              >
                {stats.presentationalDeps.map((dep, idx) => {
                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => highlightRange(dep)}
                      onMouseLeave={clearHighlight}
                      className={`dependency-item ${
                        idx === hoveredItemIndex ? "highlighted-code" : ""
                      }`}
                      style={{
                        cursor: "pointer",
                        padding: "8px",
                        borderBottom: "1px solid #303030",
                      }}
                      onClick={() => toggleExpand(idx)}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: "#e6e6e6" }}>{dep.type}</span>
                        {expandedDeps[idx] ? (
                          <IconUp style={{ marginLeft: 8 }} />
                        ) : (
                          <IconDown style={{ marginLeft: 8 }} />
                        )}
                      </div>
                      {expandedDeps[idx] && dep.ids && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px",
                            background: "#141414",
                            borderRadius: "4px",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "bold",
                              marginBottom: "4px",
                              color: "#e6e6e6",
                            }}
                          >
                            ids:
                          </div>
                          <div style={{ display: "flex", color: "#e6e6e6" }}>
                            {dep.ids.join(", ")}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "4px",
                            }}
                          >
                            {dep.ids.map((id: string, i: number) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: "12px",
                                  padding: "2px 4px",
                                  background: "#111d2c",
                                  borderRadius: "2px",
                                }}
                              >
                                {id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
              <Card
                title="Blocks"
              >
                {stats.blocks.map((block, idx) => {
                  return (
                    <div
                      key={idx}
                      className={`dependency-item ${
                        idx === hoveredItemIndex ? "highlighted-code" : ""
                      }`}
                      style={{
                        cursor: "pointer",
                        padding: "8px",
                        borderBottom: "1px solid #303030",
                      }}
                      onMouseEnter={() => highlightRange(block)}
                      onMouseLeave={clearHighlight}
                      onClick={() => toggleExpand(idx)}
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
                        {expandedDeps[idx] ? (
                          <IconUp style={{ marginLeft: 8 }} />
                        ) : (
                          <IconDown style={{ marginLeft: 8 }} />
                        )}
                      </div>
                      {expandedDeps[idx] && block.ids && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px",
                            background: "#141414",
                            borderRadius: "4px",
                          }}
                        >
                          <div
                            style={{ fontWeight: "bold", marginBottom: "4px" }}
                          >
                            ids:
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "4px",
                            }}
                          >
                            {block.ids.join(", ")}
                          </div>
                        </div>
                      )}
                      {expandedDeps[idx] && block.dependencies && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px",
                            background: "#141414",
                            borderRadius: "4px",
                          }}
                        >
                          <div
                            style={{ fontWeight: "bold", marginBottom: "4px" }}
                          >
                            Dependencies:
                          </div>
                          {block.dependencies.map((dep, depIdx) => (
                            <div key={depIdx} style={{ marginBottom: "4px" }}>
                              <div>
                                <div style={{ color: "#e6e6e6" }}>
                                  {dep.type} ({dep.category})
                                </div>
                              </div>
                              {dep.ids && (
                                <div
                                  style={{ fontSize: "12px", color: "#a6a6a6" }}
                                >
                                  {dep.ids.join(", ")}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
            </div>
          ) : (
            <div>Click Analyze to start</div>
          )}
        </div>
      </Content>
      <Sider
        width={400}
        theme="dark"
        style={{ padding: "20px", borderLeft: "1px solid #303030" }}
      >
        {stats && (
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
            }}
          >
            <div style={{ height: "calc(100vh - 180px)" }}>
              <Editor
                height="100%"
                defaultLanguage="json"
                value={JSON.stringify(stats, null, 2)}
                theme="vs-dark"
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
  );
};

export default MainLayout;
