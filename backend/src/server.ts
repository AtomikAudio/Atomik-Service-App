import 'dotenv/config';
import { connectDB } from './config/database';
import { validateProductionEnv } from './config/envValidation';
import { createApp } from './app';

validateProductionEnv();

const PORT = Number(process.env.PORT) || 5000;
const app = createApp();

const start = async () => {
  await connectDB();
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔════════════════════════════════╗`);
    console.log(`║  ATOMIK API — PORT ${PORT}         ║`);
    console.log(`║  Audio Engineering and Design  ║`);
    console.log(`║  Service Infrastructure        ║`);
    console.log(`╚════════════════════════════════╝\n`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\nPort ${PORT} is already in use. Stop the other backend (Ctrl+C in its terminal) or run:\n` +
          `  npm run dev\n` +
          `(dev now frees port 5000 automatically on startup)\n`
      );
    } else {
      console.error(err);
    }
    process.exit(1);
  });
};

start().catch(console.error);
