import { useEffect } from 'react';
import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  // Registra o service worker só no cliente (não existe durante o build/SSR) — é o que faz o
  // Chrome/Android considerar o painel "instalável" como app na tela inicial.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <>
      {/* precisa vir via next/head (não só no _document) — várias páginas (login, candidatura
          pública, feedback do gerente) têm seu próprio <Head> só com <title>, e sem uma tag de
          viewport "de página" o Next injeta a dele por padrão (só "width=device-width", sem
          initial-scale) *além* da do _document — duas tags de viewport, e o navegador usa a
          primeira, que não é a nossa. Declarando aqui, o dedupe do next/head substitui a
          automática em vez de duplicar. */}
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
