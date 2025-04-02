import React, { useState, useRef, useEffect } from "react";
import { Layout, Button, Card, Alert, message } from "antd";
import {
  PlayCircleOutlined,
  DownOutlined,
  UpOutlined,
  ShareAltOutlined,
  CodeOutlined,
} from "@ant-design/icons";
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
}

const MainLayout: React.FC<MainLayoutProps> = ({
  onCompile,
  stats,
  status,
  initialCode,
}) => {
  const [code, setCode] = useState<string>(initialCode);

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);
  const [expandedDeps, setExpandedDeps] = useState<Record<number, boolean>>({});
  const [hoveredItemIndex, setHoveredItemIndex] = useState<number | null>(null);
  const statsRef = useRef<Stats>(null);
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
    <Layout style={{ height: "100vh" }}>
      <Sider width={500} theme="light" style={{ padding: "20px", borderRight: "1px solid #f0f0f0" }}>
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
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => onCompile(code)}
            disabled={status.isCompiling || status.isInitializing}
          >
            {status.isCompiling
              ? "Analyzing..."
              : status.isInitializing
              ? "Initializing..."
              : "analyze"}
          </Button>
          <Button
            icon={<ShareAltOutlined />}
            onClick={() => {
              const encodedCode = encodeURIComponent(btoa(code));
              window.location.hash = `#code=${encodedCode}`;
              navigator.clipboard.writeText(window.location.href);
              message.success("链接已复制到剪贴板");
            }}
          >
            分享
          </Button>
        </div>
      </Sider>
      <Content style={{ padding: "20px", overflow: "auto" }}>
        <div
          style={{
            background: "#fff",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {status.isInitializing && (
            <Alert message="正在初始化 WebContainer..." type="info" showIcon />
          )}
          {status.isCompiling && (
            <Alert message="Webpack 编译中..." type="info" showIcon />
          )}
          {status.error && (
            <Alert
              message="编译错误"
              description={status.error}
              type="error"
              showIcon
            />
          )}
          {status.isCompiling || status.isInitializing ? (
            ""
          ) : stats ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <Card title="Dependencies">
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
                        borderBottom: "1px solid #f0f0f0",
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
                        <span>{dep.type}</span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#888",
                            paddingRight: "16px",
                          }}
                        >
                          {dep.category}
                        </span>
                        {expandedDeps[idx] ? (
                          <UpOutlined style={{ marginLeft: 8 }} />
                        ) : (
                          <DownOutlined style={{ marginLeft: 8 }} />
                        )}
                      </div>
                      {expandedDeps[idx] && dep.ids && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px",
                            background: "#f5f5f5",
                            borderRadius: "4px",
                          }}
                        >
                          <div
                            style={{ fontWeight: "bold", marginBottom: "4px" }}
                          >
                            IDs:
                          </div>
                          <div style={{ display: "flex" }}>
                            {dep.ids.join(", ")}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
              <Card title="Presentational Dependencies">
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
                        borderBottom: "1px solid #f0f0f0",
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
                        <span>{dep.type}</span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#888",
                            paddingRight: "16px",
                          }}
                        >
                          {dep.category}
                        </span>
                        {expandedDeps[idx] ? (
                          <UpOutlined style={{ marginLeft: 8 }} />
                        ) : (
                          <DownOutlined style={{ marginLeft: 8 }} />
                        )}
                      </div>
                      {expandedDeps[idx] && dep.ids && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px",
                            background: "#f5f5f5",
                            borderRadius: "4px",
                          }}
                        >
                          <div
                            style={{ fontWeight: "bold", marginBottom: "4px" }}
                          >
                            IDs:
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "4px",
                            }}
                          >
                            {dep.ids.map((id, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: "12px",
                                  padding: "2px 4px",
                                  background: "#e6f7ff",
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
              <Card title="Blocks">
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
                        borderBottom: "1px solid #f0f0f0",
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
                        <span>Async Dependency Block</span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#888",
                            paddingRight: "16px",
                          }}
                        >
                          {block.category}
                        </span>
                        {expandedDeps[idx] ? (
                          <UpOutlined style={{ marginLeft: 8 }} />
                        ) : (
                          <DownOutlined style={{ marginLeft: 8 }} />
                        )}
                      </div>
                      {expandedDeps[idx] && block.ids && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px",
                            background: "#f5f5f5",
                            borderRadius: "4px",
                          }}
                        >
                          <div
                            style={{ fontWeight: "bold", marginBottom: "4px" }}
                          >
                            IDs:
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
                            background: "#f5f5f5",
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
                                {dep.type} ({dep.category})
                              </div>
                              {dep.ids && (
                                <div
                                  style={{ fontSize: "12px", color: "#666" }}
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
            <div>Click to start</div>
          )}
        </div>
      </Content>
      <Sider width={400} theme="light" style={{ padding: "20px", borderLeft: "1px solid #f0f0f0" }}>
        {stats && (
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CodeOutlined />
                <span>Stats JSON</span>
              </div>
            }
            style={{ height: "100%", overflow: "auto" }}
          >
            <pre
              style={{
                margin: 0,
                padding: "8px",
                background: "#f5f5f5",
                borderRadius: "4px",
                fontSize: "12px",
                lineHeight: "1.5",
                overflow: "auto",
                maxHeight: "calc(100vh - 150px)",
              }}
            >
              {JSON.stringify(stats, null, 2)}
            </pre>
          </Card>
        )}
      </Sider>
    </Layout>
  );
};

export default MainLayout;
