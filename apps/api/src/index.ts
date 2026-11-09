import { createApp } from './app.js';
import { env } from './lib/env.js';

const app = createApp();

if (!process.env.VERCEL) {
  app.listen(env.PORT, () => {
    console.log(`Detsbee API listening on http://localhost:${env.PORT}`);
  });
}
