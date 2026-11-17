import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createServer as createViteServer} from 'vite';

function readArtifact(relPath: string, label: string) {
  const full = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(full)) return null;
  return {
    path: relPath,
    label,
    content: fs.readFileSync(full, 'utf8'),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/artifacts', (_req, res) => {
    const artifacts = [
      readArtifact('firestore.rules', 'Firestore Security Rules (firestore.rules)'),
      readArtifact('database/schema.sql', 'MySQL Schema (schema.sql)'),
      readArtifact('backend_api/server.js', 'Node.js API (backend_api/server.js)'),
      readArtifact('backend_api/package.json', 'Backend package.json'),
      readArtifact('mobile_app/lib/main.dart', 'Flutter App (mobile_app/lib/main.dart)'),
      readArtifact('.github/workflows/build_apk.yml', 'GitHub APK Workflow'),
      readArtifact('.gitignore', 'Unified .gitignore'),
    ].filter(Boolean);

    res.json({artifacts});
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Krishna Recharge server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
