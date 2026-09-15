import { ensureLocalDatabase, LOCAL_DB } from './local-db';

async function startLocalDb() {
  const { pg } = await ensureLocalDatabase();

  if (!pg) {
    console.log('PostgreSQL is already running.');
    process.exit(0);
  }

  console.log(`DATABASE_URL=${LOCAL_DB.url}`);
  console.log('Press Ctrl+C to stop.');

  const shutdown = async () => {
    await pg.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void startLocalDb().catch((error: unknown) => {
  console.error('Failed to start local database:', error);
  process.exit(1);
});
