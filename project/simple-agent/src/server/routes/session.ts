// src/server/routes/session.ts
import { Router } from 'express';
import { readdir, readFile, writeFile, rm, stat } from 'fs/promises';
import { join } from 'path';
import type { Session } from '../../storage/json';
import type { Session as SessionResponse } from '../types';

const router = Router();

export function createSessionRouter(sessionDir: string) {
  router.get('/', async (_req, res) => {
    try {
      const files = await readdir(sessionDir);
      const sessions: SessionResponse[] = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async f => {
            const id = f.replace('.json', '');
            try {
              const data = await readFile(join(sessionDir, f), 'utf-8');
              const session = JSON.parse(data) as Session;
              return {
                id: session.id,
                createdAt: new Date(session.createdAt).toISOString(),
                lastMessage: session.messages.length > 0
                  ? session.messages[session.messages.length - 1].content
                  : '',
              };
            } catch {
              return { id, createdAt: '', lastMessage: '' };
            }
          })
      );
      res.json({ sessions });
    } catch (error) {
      console.error('Failed to list sessions:', error);
      res.status(500).json({ error: 'Failed to list sessions' });
    }
  });

  router.post('/', async (_req, res) => {
    try {
      const sessionId = `session-${Date.now()}`;
      const now = Date.now();
      const session: Session = {
        id: sessionId,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      await writeFile(
        join(sessionDir, `${sessionId}.json`),
        JSON.stringify(session, null, 2),
        'utf-8'
      );
      res.status(201).json({ sessionId });
    } catch (error) {
      console.error('Failed to create session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const filePath = join(sessionDir, `${req.params.id}.json`);
      try {
        await stat(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          res.status(404).json({ error: 'Session not found' });
          return;
        }
        throw error;
      }
      await rm(filePath);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete session:', error);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  });

  return router;
}
