import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface LogEntry {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
}

interface AgentStore {
  // Session
  currentSessionId: string | null;
  sessions: Array<{ id: string; createdAt: string; lastMessage?: string }>;
  setCurrentSession: (id: string | null) => void;
  setSessions: (sessions: Array<{ id: string; createdAt: string; lastMessage?: string }>) => void;

  // Messages
  messages: Message[];
  addMessage: (msg: Message) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;

  // Console logs
  logs: LogEntry[];
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;

  // Status
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
}

export const useStore = create<AgentStore>((set) => ({
  currentSessionId: null,
  sessions: [],
  setCurrentSession: (id) => set({ currentSessionId: id }),
  setSessions: (sessions) => set({ sessions }),

  messages: [],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateLastMessage: (content) =>
    set((state) => ({
      messages: state.messages.map((m, i) =>
        i === state.messages.length - 1 ? { ...m, content } : m
      ),
    })),
  clearMessages: () => set({ messages: [] }),

  logs: [],
  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  clearLogs: () => set({ logs: [] }),

  isRunning: false,
  setIsRunning: (running) => set({ isRunning: running }),
}));
