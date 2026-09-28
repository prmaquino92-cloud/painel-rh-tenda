import { useEffect } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  // Registra o service worker só no cliente (não existe durante o build/SSR) — é o que faz o
  // Chrome/Android considerar o painel "instalável" como app na tela inicial.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return <Component {...pageProps} />;
}
