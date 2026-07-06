import { config } from './config';
import { createApp } from './app';

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`[prego] Server läuft auf Port ${config.PORT} – ${config.APP_URL}`);
});
