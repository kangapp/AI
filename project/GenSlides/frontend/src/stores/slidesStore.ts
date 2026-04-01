import { create } from 'zustand';
import type { Slide, ImageInfo, CostInfo, PlaybackSlide } from '../types';
import { slidesApi, costApi, playbackApi } from '../api';

interface SlidesState {
  // Data
  slides: Slide[];
  title: string;
  selectedSid: string | null;
  images: Record<string, ImageInfo[]>;
  cost: CostInfo | null;
  playbackSlides: PlaybackSlide[];
  playbackIndex: number;

  // UI State
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;

  // Current project slug
  selectedProjectSlug: string | null;

  // Actions
  loadSlides: (projectSlug?: string) => Promise<void>;
  createSlide: (text?: string) => Promise<void>;
  updateSlide: (sid: string, text: string) => Promise<void>;
  deleteSlide: (sid: string) => Promise<void>;
  selectSlide: (sid: string | null) => void;
  generateImage: (sid: string, provider?: 'gemini' | 'minimax') => Promise<void>;
  loadImages: (sid: string, projectSlug?: string) => Promise<void>;
  loadCost: () => Promise<void>;
  startPlayback: () => Promise<void>;
  nextSlide: () => void;
  prevSlide: () => void;
  exitPlayback: () => void;
}

export const useSlidesStore = create<SlidesState>((set, get) => ({
  // Initial state
  slides: [],
  title: 'Untitled',
  selectedSid: null,
  images: {},
  cost: null,
  playbackSlides: [],
  playbackIndex: 0,
  isPlaying: false,
  isLoading: false,
  error: null,
  selectedProjectSlug: null,

  loadSlides: async (projectSlug?: string) => {
    set({ isLoading: true, error: null });
    try {
      const slug = projectSlug || get().selectedProjectSlug || 'default';
      set({ selectedProjectSlug: slug });
      const data = await slidesApi.getAll(slug);
      set({ slides: data.slides, title: data.title, isLoading: false });

      // Auto-select first slide
      if (data.slides.length > 0 && !get().selectedSid) {
        const firstSid = data.slides[0].sid;
        set({ selectedSid: firstSid });
        get().loadImages(firstSid, slug);
      }
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createSlide: async (text = '新幻灯片') => {
    const { selectedProjectSlug } = get();
    const slug = selectedProjectSlug || 'default';
    set({ isLoading: true, error: null });
    try {
      const slide = await slidesApi.create(slug, text);
      set(state => ({
        slides: [...state.slides, slide],
        selectedSid: slide.sid,
        isLoading: false
      }));
      get().loadImages(slide.sid, slug);
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateSlide: async (sid: string, text: string) => {
    const { selectedProjectSlug } = get();
    const slug = selectedProjectSlug || 'default';
    try {
      await slidesApi.update(slug, sid, text);
      set(state => ({
        slides: state.slides.map(s => s.sid === sid ? { ...s, text } : s)
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteSlide: async (sid: string) => {
    const { selectedProjectSlug } = get();
    const slug = selectedProjectSlug || 'default';
    try {
      await slidesApi.delete(slug, sid);
      set(state => {
        const newSlides = state.slides.filter(s => s.sid !== sid);
        const newSelected = state.selectedSid === sid
          ? (newSlides[0]?.sid ?? null)
          : state.selectedSid;
        return { slides: newSlides, selectedSid: newSelected };
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  selectSlide: (sid: string | null) => {
    set({ selectedSid: sid });
    if (sid) {
      get().loadImages(sid, get().selectedProjectSlug || 'default');
    }
  },

  generateImage: async (sid: string, provider = 'minimax') => {
    const { selectedProjectSlug } = get();
    const slug = selectedProjectSlug || 'default';
    set({ isLoading: true, error: null });
    try {
      const result = await slidesApi.generate(slug, sid, provider);
      set(state => {
        const newImages = { ...state.images };
        newImages[sid] = [
          { hash: result.hash, url: result.image_url, cached: result.cached },
          ...(newImages[sid] || []).filter(i => i.hash !== result.hash)
        ];
        return { images: newImages, isLoading: false };
      });
      get().loadCost();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  loadImages: async (sid: string, projectSlug?: string) => {
    const slug = projectSlug || get().selectedProjectSlug || 'default';
    try {
      const { images } = await slidesApi.getImages(slug, sid);
      set(state => ({ images: { ...state.images, [sid]: images } }));
    } catch (err) {
      console.error('Failed to load images:', err);
    }
  },

  loadCost: async () => {
    try {
      const cost = await costApi.get();
      set({ cost });
    } catch (err) {
      console.error('Failed to load cost:', err);
    }
  },

  startPlayback: async () => {
    const { selectedSid, slides } = get();
    const startIndex = slides.findIndex(s => s.sid === selectedSid) ?? 0;

    try {
      const data = await playbackApi.getSlides(startIndex);
      set({
        playbackSlides: data.slides,
        playbackIndex: data.start_index,
        isPlaying: true
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  nextSlide: () => {
    set(state => ({
      playbackIndex: Math.min(state.playbackIndex + 1, state.playbackSlides.length - 1)
    }));
  },

  prevSlide: () => {
    set(state => ({
      playbackIndex: Math.max(state.playbackIndex - 1, 0)
    }));
  },

  exitPlayback: () => {
    set({ isPlaying: false, playbackSlides: [], playbackIndex: 0 });
  },
}));