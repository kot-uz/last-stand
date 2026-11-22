import './ui/style.css';
import { buildAll } from './render/sprites';
import { App } from './ui/app';

buildAll();
const app = new App();
if (import.meta.env.DEV) (window as any).app = app;
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}));
}
