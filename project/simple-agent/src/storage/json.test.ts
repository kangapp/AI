/**
 * Tests for JsonSessionStorage
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { JsonSessionStorage, type Session } from './json';

describe('JsonSessionStorage', () => {
  const testDir = '/tmp/test-storage-' + Date.now();
  let storage: JsonSessionStorage;

  beforeEach(async () => {
    // Create a fresh test directory
    await mkdir(testDir, { recursive: true });
    storage = new JsonSessionStorage(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('save and load', () => {
    it('should save and load a session', async () => {
      const session: Session = {
        id: 'test-session-1',
        createdAt: 1234567890,
        updatedAt: 1234567891,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };

      await storage.save(session);
      const loaded = await storage.load('test-session-1');

      expect(loaded).toEqual(session);
    });

    it('should return null for non-existent session', async () => {
      const loaded = await storage.load('non-existent');
      expect(loaded).toBeNull();
    });

    it('should overwrite existing session', async () => {
      const session1: Session = {
        id: 'test-session',
        createdAt: 1000,
        updatedAt: 1000,
        messages: [{ role: 'user', content: 'Original' }],
      };

      const session2: Session = {
        id: 'test-session',
        createdAt: 1000,
        updatedAt: 2000,
        messages: [{ role: 'user', content: 'Updated' }],
      };

      await storage.save(session1);
      await storage.save(session2);
      const loaded = await storage.load('test-session');

      expect(loaded?.updatedAt).toBe(2000);
      expect(loaded?.messages[0].content).toBe('Updated');
    });
  });

  describe('list', () => {
    it('should list all sessions', async () => {
      const session1: Session = {
        id: 'session-a',
        createdAt: 1000,
        updatedAt: 1001,
        messages: [],
      };

      const session2: Session = {
        id: 'session-b',
        createdAt: 2000,
        updatedAt: 2001,
        messages: [],
      };

      await storage.save(session1);
      await storage.save(session2);

      const list = await storage.list();

      expect(list).toHaveLength(2);
      expect(list.map((s) => s.id).sort()).toEqual(['session-a', 'session-b']);
    });

    it('should return empty array when no sessions exist', async () => {
      const list = await storage.list();
      expect(list).toHaveLength(0);
    });

    it('should only return metadata (not messages)', async () => {
      const session: Session = {
        id: 'meta-test',
        createdAt: 1000,
        updatedAt: 2000,
        messages: [{ role: 'user', content: 'Should not appear' }],
      };

      await storage.save(session);
      const list = await storage.list();

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('meta-test');
      expect(list[0].createdAt).toBe(1000);
      expect(list[0].updatedAt).toBe(2000);
    });
  });

  describe('delete', () => {
    it('should delete an existing session', async () => {
      const session: Session = {
        id: 'to-delete',
        createdAt: 1000,
        updatedAt: 1000,
        messages: [],
      };

      await storage.save(session);
      await storage.delete('to-delete');
      const loaded = await storage.load('to-delete');

      expect(loaded).toBeNull();
    });

    it('should not throw when deleting non-existent session', async () => {
      await expect(storage.delete('non-existent')).resolves.toBeUndefined();
    });
  });
});
