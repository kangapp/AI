import { create } from 'zustand';

export enum ProjectStyle {
  CUSTOM = 'custom',
  PHOTOREALISTIC = 'photorealistic',
  ANIME = 'anime',
  INK_WASH = 'ink-wash',
  CYBERPUNK = 'cyberpunk',
  MINIMALIST = 'minimalist',
  OIL_PAINTING = 'oil-painting',
}

export interface Project {
  slug: string;
  name: string;
  style: string;
  style_prompt: string;
  created_at: string;
  slide_count?: number;
  thumbnail_url?: string;
  image_count?: number;
}

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  isCreating: boolean;
  error: string | null;

  loadProjects: () => Promise<void>;
  createProject: (data: { name: string; style: ProjectStyle; style_prompt: string }) => Promise<Project | null>;
  deleteProject: (slug: string) => Promise<void>;
}

const API_BASE = '/api';

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  loading: false,
  isCreating: false,
  error: null,

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/projects`);
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json();

      const projectsWithMeta = data.projects.map((p: Project) => ({
        ...p,
        slide_count: data.slide_counts?.[p.slug] || 0,
        thumbnail_url: data.thumbnails?.[p.slug] || null,
      }));

      set({ projects: projectsWithMeta, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createProject: async (data) => {
    set({ isCreating: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create project');
      }
      const project = await res.json();
      set(state => ({
        projects: [project, ...state.projects],
        isCreating: false
      }));
      return project;
    } catch (err) {
      set({ error: (err as Error).message, isCreating: false });
      return null;
    }
  },

  deleteProject: async (slug) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${slug}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete project');
      set(state => ({
        projects: state.projects.filter(p => p.slug !== slug)
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));