import { gas } from '../api/client';

export function kuzatuvniBoshlash() {
  window.addEventListener('error', (e) => {
    // Only catch runtime errors, not resource loading errors that don't have a message
    if (e.message) {
      gas('apiXatoYoz', 'js', e.message, e.filename, e.lineno).catch(() => {});
    }
  });

  window.addEventListener('unhandledrejection', (e) => {
    gas('apiXatoYoz', 'promise', String(e.reason)).catch(() => {});
  });
}
