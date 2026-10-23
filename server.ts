import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const { app, initServerApp } = require('./server/src/index.js');
const seedDatabase = require('./server/src/seed.js');

const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

async function bootstrap() {
  console.log('⚡ Initializing ClassGuard AI unified full-stack server...');
  await initServerApp();
  await seedDatabase();

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🛡️  ClassGuard AI running on http://0.0.0.0:${PORT}`);
    console.log(`🔒 Privacy-First Architecture: 0 Video Bytes Uploaded`);
    console.log(`⚖️  Multi-role access: Student, Teacher, Super Admin`);
    console.log(`=======================================================`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
