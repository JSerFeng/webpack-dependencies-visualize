import React, { useState, useRef } from "react";
import { Layout, Button, Card, Alert } from "antd";
import {
  PlayCircleOutlined,
  DownOutlined,
  UpOutlined,
} from "@ant-design/icons";
import Editor, { useMonaco } from "@monaco-editor/react";
import type { WebpackDependency } from "../utils/webpackCompiler";
import type { editor } from "monaco-editor";

const { Sider, Content } = Layout;

interface MainLayoutProps {
  onCompile: (code: string) => void;
  stats: {
    deps: WebpackDependency[];
  };
  status: {
    isInitializing: boolean;
    isCompiling: boolean;
    error: string | null;
  };
}

const MainLayout: React.FC<MainLayoutProps> = ({
  onCompile,
  stats,
  status,
}) => {
  const [code, setCode] = useState<string>("");
  const [expandedDeps, setExpandedDeps] = useState<Record<number, boolean>>({});
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

  const highlightRange = (dep: WebpackDependency) => {
    if (!editorRef.current || !monaco || !dep.loc) return;

    if (!("start" in dep.loc) || !("end" in dep.loc)) {
      return;
    }

    const { start, end } = dep.loc as {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };

    const range = new monaco.Range(start.line, start.column + 1, end.line, end.column + 1);

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

  return (
    <Layout style={{ height: "100vh" }}>
      <Sider width={500} theme="light" style={{ padding: "20px" }}>
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
                      className="dependency-item"
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
                        <span style={{ fontSize: "12px", color: "#888" }}>
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
            </div>
          ) : (
            <div>Click to start</div>
          )}
        </div>
      </Content>
    </Layout>
  );
};

export default MainLayout;
