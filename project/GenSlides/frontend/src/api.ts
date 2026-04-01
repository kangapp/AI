import type {
  Slide, SlideListResponse,
  ImageInfo, GenerateRequest, GenerateResponse,
  CostInfo, PlaybackResponse
} from './types';

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

// Slides API
export const slidesApi = {
  getAll: (): Promise<SlideListResponse> =>
    fetchJSON('/slides'),

  create: (text: string): Promise<Slide> =>
    fetchJSON('/slides', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  update: (sid: string, text: string): Promise<Slide> =>
    fetchJSON(`/slides/${sid}`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
    }),

  delete: (sid: string): Promise<void> => {
    return fetch(`${API_BASE}/slides/${sid}`, {
      method: 'DELETE',
    }).then(r => r.json());
  },

  generate: (sid: string, provider: 'gemini' | 'minimax' = 'minimax', force = false): Promise<GenerateResponse> =>
    fetchJSON(`/slides/${sid}/generate`, {
      method: 'POST',
      body: JSON.stringify({ provider, force }),
    }),

  getImages: (sid: string): Promise<{ images: ImageInfo[] }> =>
    fetchJSON(`/slides/${sid}/images`),
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
