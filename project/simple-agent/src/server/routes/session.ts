// src/server/routes/session.ts
import { Router } from 'express';
import { readdir, rm } from 'fs/promises';
import { join } from 'path';
import type { Session } from '../types';

const router = Router();

export function createSessionRouter(sessionDir: string) {
  router.get('/', async (_req, res) => {
    try {
      const files = await readdir(sessionDir);
      const sessions: Session[] = files
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const id = f.replace('.json', '');
          return { id, createdAt: '', lastMessage: '' };
        });
      res.json({ sessions });
    } catch {
      res.json({ sessions: [] });
    }
  });

  router.post('/', (_req, res) => {
    const sessionId = `session-${Date.now()}`;
    res.json({ sessionId });
  });

  router.delete('/:id', async (req, res) => {
    try {
      await rm(join(sessionDir, `${req.params.id}.json`));
      res.json({ success: true });
    } catch {
      res.json({ success: false });
    }
  });

  return router;
}