import { useState, useEffect } from 'react';
import { message } from 'antd';
import MainLayout from './components/MainLayout';
import { compileCode } from './utils/webpackCompiler';
import { initWebContainer, destroyWebContainer } from './utils/webContainer';
import './App.css';

function App() {
  const [stats, setStats] = useState<any>(null);
  const [status, setStatus] = useState({
    isInitializing: true,
    isCompiling: false,
    error: null as string | null
  });
  const [initialCode, setInitialCode] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('code=')) {
      const encodedCode = hash.split('code=')[1];
      try {
        const code = atob(decodeURIComponent(encodedCode));
        setInitialCode(code);
      } catch (error) {
        console.error('Failed to decode URL code:', error);
      }
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
    const result = await compileCode(code);

    if (result.success && result.data) {
      setStats(result.data);
      setStatus(prev => ({ ...prev, isCompiling: false }));
    } else {
      setStatus(prev => ({ ...prev, isCompiling: false, error: result.error || '编译失败' }));
      message.error(result.error || '编译失败');
    }
  };

  return (
    <div style={{ height: '100vh' }}>
      <MainLayout 
        onCompile={handleCompile} 
        stats={stats} 
        status={status}
        initialCode={initialCode}
      />
    </div>
  );
}

export default App;
