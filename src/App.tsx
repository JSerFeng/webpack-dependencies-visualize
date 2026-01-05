import { useState, useEffect } from 'react';
import { Message } from '@arco-design/web-react';
import MainLayout from './components/MainLayout';
import { compileCode, FileMap } from './utils/webpackCompiler';
import { initWebContainer, destroyWebContainer } from './utils/webContainer';
import '@arco-design/web-react/dist/css/arco.css';
import './App.css';

function App() {
  const [stats, setStats] = useState<any>(null);
  const [status, setStatus] = useState({
    isInitializing: true,
    isCompiling: false,
    error: null as string | null
  });
  const [initialFiles, setInitialFiles] = useState<FileMap | null>(null);
  const [mode, setMode] = useState<'development' | 'production'>('production');

  useEffect(() => {
    const hash = window.location.hash.slice(1); // remove #
    if (!hash) return;

    const params = new URLSearchParams(hash);
    
    // Try new multi-file format first
    const encodedFiles = params.get('files');
    if (encodedFiles) {
      try {
        const filesJson = decodeURIComponent(escape(atob(decodeURIComponent(encodedFiles))));
        const files = JSON.parse(filesJson) as FileMap;
        setInitialFiles(files);
      } catch (error) {
        console.error('Failed to decode URL files:', error);
      }
    } else {
      // Fallback to legacy single-file format
      let encodedCode = params.get('code');
      if (!encodedCode && hash.includes('code=')) {
          encodedCode = hash.split('code=')[1];
      }

      if (encodedCode) {
        try {
          const code = atob(decodeURIComponent(encodedCode));
          // Legacy format: only index.js
          setInitialFiles({ "index.js": code });
        } catch (error) {
          console.error('Failed to decode URL code:', error);
        }
      }
    }

    const modeParam = params.get('mode');
    if (modeParam === 'development' || modeParam === 'production') {
        setMode(modeParam);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await initWebContainer();
        setStatus(prev => ({ ...prev, isInitializing: false }));
      } catch (error) {
        setStatus(prev => ({
          ...prev,
          isInitializing: false,
          error: '初始化WebContainer失败：' + (error as Error).message
        }));
      }
    };
    init();

    return () => {
      destroyWebContainer();
    };
  }, []);

  const handleCompile = async (files: FileMap) => {
    setStatus(prev => ({ ...prev, isCompiling: true, error: null }));
    const result = await compileCode(files, mode);

    if (result.success && result.data) {
      setStats(result.data);
      setStatus(prev => ({ ...prev, isCompiling: false }));
    } else {
      setStatus(prev => ({ ...prev, isCompiling: false, error: result.error || '编译失败' }));
      Message.error(result.error || '编译失败');
    }
  };

  return (
    <div style={{ height: '100vh' }}>
      <MainLayout 
        onCompile={handleCompile} 
        stats={stats} 
        status={status}
        initialFiles={initialFiles}
        mode={mode}
        setMode={setMode}
      />
    </div>
  );
}

export default App;

