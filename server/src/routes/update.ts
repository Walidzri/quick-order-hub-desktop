import { FastifyInstance } from 'fastify';
import { updateState, updaterCheckForUpdates, updaterDownload, updaterInstall } from '../../../electron/main';

export async function updateRoutes(fastify: FastifyInstance) {
  // GET /api/update/status — current update state
  fastify.get('/api/update/status', async () => {
    return {
      status: updateState.status,
      currentVersion: updateState.appVersion,
      availableVersion: updateState.version,
      releaseNotes: updateState.releaseNotes,
      progress: updateState.progress,
      error: updateState.error,
    };
  });

  // POST /api/update/check — trigger update check
  fastify.post('/api/update/check', async () => {
    updaterCheckForUpdates();
    return { ok: true, message: 'Update check started' };
  });

  // POST /api/update/download — start downloading the update
  fastify.post('/api/update/download', async () => {
    if (updateState.status !== 'available') {
      return { ok: false, error: 'No update available to download' };
    }
    updaterDownload();
    return { ok: true, message: 'Download started' };
  });

  // POST /api/update/install — quit and install the update
  fastify.post('/api/update/install', async () => {
    if (updateState.status !== 'downloaded') {
      return { ok: false, error: 'No update downloaded to install' };
    }
    // This will quit the app and install — response may not reach client
    setTimeout(() => updaterInstall(), 500);
    return { ok: true, message: 'Installing update, app will restart...' };
  });
}
