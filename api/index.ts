import type { Request, Response } from 'express';
import type { Express } from 'express';

// Vercel loads this entrypoint as CommonJS in some Node runtimes, while the
// API workspace is an ES module. Keep the import dynamic so the module formats
// remain compatible, and reuse the Express app for warm function invocations.
let appPromise: Promise<Express> | undefined;

export default async function handler(req: Request, res: Response) {
  appPromise ??= import('../apps/api/src/app.js').then(({ createApp }) => createApp());
  const app = await appPromise;
  return app(req, res);
}
