import type {
  Slide, SlideListResponse,
  ImageInfo, GenerateResponse,
  CostInfo, PlaybackResponse
} from './types';
import type { Project } from './stores/projectsStore';

const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Slides API - all methods accept slug parameter
export const slidesApi = {
  getAll: (slug: string): Promise<SlideListResponse> =>
    fetchJSON(`/projects/${slug}/slides`),

  create: (slug: string, text: string): Promise<Slide> =>
    fetchJSON(`/projects/${slug}/slides`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  update: (slug: string, sid: string, text: string): Promise<Slide> =>
    fetchJSON(`/projects/${slug}/slides/${sid}`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
    }),

  delete: (slug: string, sid: string): Promise<void> =>
    fetch(`${API_BASE}/projects/${slug}/slides/${sid}`, {
      method: 'DELETE',
    }).then(r => r.json()),

  generate: (slug: string, sid: string, provider: 'gemini' | 'minimax' = 'minimax', force = false): Promise<GenerateResponse> =>
    fetchJSON(`/projects/${slug}/slides/${sid}/generate`, {
      method: 'POST',
      body: JSON.stringify({ provider, force }),
    }),

  getImages: (slug: string, sid: string): Promise<{ images: ImageInfo[] }> =>
    fetchJSON(`/projects/${slug}/slides/${sid}/images`),
};

// Projects API
export { type Project } from './stores/projectsStore';
export { useProjectsStore } from './stores/projectsStore';

export const projectsApi = {
  getAll: (): Promise<{ projects: Project[]; slide_counts: Record<string, number>; thumbnails: Record<string, string> }> =>
    fetchJSON('/projects'),

  create: (data: { name: string; style: string; style_prompt: string }): Promise<Project> =>
    fetchJSON('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (slug: string): Promise<Project> =>
    fetchJSON(`/projects/${slug}`),

  delete: (slug: string): Promise<void> =>
    fetch(`${API_BASE}/projects/${slug}`, { method: 'DELETE' }).then(r => r.json()),
};

// Cost API
export const costApi = {
  get: (): Promise<CostInfo> => fetchJSON('/cost'),
};

// Playback API
export const playbackApi = {
  getSlides: (startIndex = 0): Promise<PlaybackResponse> =>
    fetchJSON(`/playback/slides?start_index=${startIndex}`),
};