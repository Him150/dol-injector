import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

function waitForTarget(): Promise<void> {
  return new Promise(resolve => {
    if (document.querySelector('#startBannerModLoaderGui')) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector('#startBannerModLoaderGui')) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });
}

async function bootstrap() {
  await waitForTarget();

  if (document.getElementById('dol-root')) return;

  const container = document.createElement('div');
  container.id = 'dol-root';
  document.body.appendChild(container);

  ReactDOM.createRoot(container).render(<App />);
}

bootstrap();
