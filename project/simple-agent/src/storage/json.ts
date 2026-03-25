/**
 * JSON file-based session storage
 */

import { mkdir, readFile, writeFile, unlink, readdir } from 'fs/promises';
import { join } from 'path';
import type { Message } from '../types';

// Session types
export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

export interface SessionMeta {
  id: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * JSON file-based session storage implementation
 * Stores each session as a separate JSON file in the specified directory
 */
export class JsonSessionStorage {
  private storageDir: string;

  constructor(storageDir: string) {
    this.storageDir = storageDir;
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    const { mkdir } = await import('fs/promises');
    try {
      await mkdir(this.storageDir, { recursive: true });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Get the file path for a session
   */
  private getSessionPath(sessionId: string): string {
    return join(this.storageDir, `${sessionId}.json`);
  }

  /**
   * Save a session to disk
   */
  async save(session: Session): Promise<void> {
    await this.ensureStorageDir();
    const filePath = this.getSessionPath(session.id);
    const data = JSON.stringify(session, null, 2);
    await writeFile(filePath, data, 'utf-8');
  }

  /**
   * Load a session from disk
   */
  async load(sessionId: string): Promise<Session | null> {
    const filePath = this.getSessionPath(sessionId);
    try {
      const data = await readFile(filePath, 'utf-8');
      return JSON.parse(data) as Session;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all sessions (metadata only)
   */
  async list(): Promise<SessionMeta[]> {
    await this.ensureStorageDir();
    const files = await readdir(this.storageDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const sessions: SessionMeta[] = [];
    for (const file of jsonFiles) {
      try {
        const filePath = join(this.storageDir, file);
        const data = await readFile(filePath, 'utf-8');
        const session = JSON.parse(data) as Session;
        sessions.push({
          id: session.id,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        });
      } catch {
        // Skip invalid files
      }
    }

    return sessions;
  }

  /**
   * Delete a session from disk
   */
  async delete(sessionId: string): Promise<void> {
    const filePath = this.getSessionPath(sessionId);
    try {
      await unlink(filePath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
