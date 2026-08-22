import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Vite dev middleware to handle /api/shopee/proxy during local development
function shopeeDevApiPlugin(): Plugin {
  return {
    name: 'shopee-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/shopee/proxy')) {
          const urlObj = new URL(req.url, 'http://localhost');
          let bodyStr = '';

          req.on('data', (chunk) => {
            bodyStr += chunk;
          });

          req.on('end', async () => {
            try {
              let body: any = {};
              if (bodyStr) {
                try {
                  body = JSON.parse(bodyStr);
                } catch {
                  body = {};
                }
              }

              const { default: handler } = await import('./api/shopee/proxy.ts');

              const mockReq = {
                method: req.method,
                query: Object.fromEntries(urlObj.searchParams.entries()),
                body,
                headers: req.headers,
              };

              const mockRes = {
                setHeader: (name: string, value: string) => res.setHeader(name, value),
                status: (statusCode: number) => {
                  res.statusCode = statusCode;
                  return mockRes;
                },
                json: (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                },
                end: (data?: any) => res.end(data),
              };

              await handler(mockReq, mockRes);
            } catch (err: any) {
              console.error('Shopee Dev Proxy Middleware Error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Dev proxy error' }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), shopeeDevApiPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
