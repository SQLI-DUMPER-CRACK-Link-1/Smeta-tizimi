import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    {
      name: 'gas-proxy',
      configureServer(server) {
        server.middlewares.use('/api/gas', (req, res) => {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const r = await fetch('https://script.google.com/macros/s/AKfycbx0tzNBlYPgaks51yZk6hU3d5UU32LjXvybSJWXekup7HxgjcCk86gVrCy_9X12dQIbTQ/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                  __api: 1,
                  token: '6db28061340748baa2d17f5c62dcfde307627fee',
                  fn: data.fn,
                  args: data.args || []
                }),
                redirect: 'follow'
              });
              res.setHeader('Content-Type', 'application/json');
              res.end(await r.text());
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: e.message }));
            }
          });
        });
      }
    }
  ],
})
