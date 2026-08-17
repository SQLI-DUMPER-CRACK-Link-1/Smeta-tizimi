import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      tailwindcss(),
      react(),
      {
        /* ⚠️ 2026-08-17 — FAQAT DEV. Produksiyada sessiyani Cloudflare
         * Pages Function (`functions/api/sessiya.ts`) beradi, bu kod
         * bundle'ga TUSHMAYDI (`configureServer` faqat `vite dev` da ishlaydi).
         *
         * NIMA UCHUN KERAK: `/api/sessiya` dev'da stub qilinmagani uchun
         * admin sahifalari LOKAL ochilmasdi — qobiq darhol kirish sahifasiga
         * otib yuborardi. Natijada UI xatolarini faqat produksiyada, qo'lda
         * topish mumkin edi. Endi `npm run dev` da butun admin panel ochiladi
         * va yiqilishlar shu yerda ko'rinadi. */
        name: 'dev-sessiya-stub',
        configureServer(server) {
          server.middlewares.use('/api/sessiya', (_req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              ok: true, rol: 'admin', email: 'dev@localhost',
              yozaOladi: true, tugaydi: Date.now() + 8 * 3600 * 1000,
            }));
          });
        },
      },
      {
        name: 'gas-proxy',
        configureServer(server) {
          server.middlewares.use('/api/gas', (req, res) => {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const r = await fetch(env.GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                  __api: 1,
                  token: env.GAS_TOKEN,
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
  }
})
