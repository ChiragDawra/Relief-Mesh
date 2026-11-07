import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = createApp(config);

app.listen(config.PORT, () => {
  console.log(`ReliefMesh API listening on http://localhost:${config.PORT}/api/v1`);
});
