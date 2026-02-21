import ReactDOM from 'react-dom/client';
import App from './App';
import indexStyle from './index.css?inline';
import { HeroUIProvider } from '@heroui/react';

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

  const style = document.createElement('style');
  style.textContent = indexStyle;
  document.body.appendChild(style);

  const container = document.createElement('div');
  container.id = 'dol-root';
  document.body.appendChild(container);

  ReactDOM.createRoot(container).render(
    <HeroUIProvider className='dark text-foreground bg-background'>
      <App />
    </HeroUIProvider>,
  );
}

bootstrap();
