import { useState, useEffect } from 'react';
import { Message } from '@arco-design/web-react';
import MainLayout from './components/MainLayout';
import { compileCode } from './utils/webpackCompiler';
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
  const [initialCode, setInitialCode] = useState('');
  const [mode, setMode] = useState<'development' | 'production'>('development');

  useEffect(() => {
    const hash = window.location.hash.slice(1); // remove #
    if (!hash) return;

    // Handle legacy format (simple string) vs new params
    const params = new URLSearchParams(hash);
    
    // Try getting code from params, fallback to splitting string if not found
    // (legacy URls were typically #code=...)
    let encodedCode = params.get('code');
    if (!encodedCode && hash.includes('code=')) {
        encodedCode = hash.split('code=')[1];
    }

    if (encodedCode) {
      try {
        const code = atob(decodeURIComponent(encodedCode));
        setInitialCode(code);
      } catch (error) {
        console.error('Failed to decode URL code:', error);
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

  const handleCompile = async (code: string) => {
    setStatus(prev => ({ ...prev, isCompiling: true, error: null }));
    const result = await compileCode(code, mode);

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
        initialCode={initialCode}
        mode={mode}
        setMode={setMode}
      />
    </div>
  );
}

export default App;
