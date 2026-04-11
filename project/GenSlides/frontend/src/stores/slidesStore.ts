import { create } from 'zustand';
import type { Slide, ImageInfo, CostInfo, PlaybackSlide } from '../types';
import { slidesApi, costApi, playbackApi } from '../api';
import { useProjectsStore } from './projectsStore';

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
  generatingSid: string | null;  // 正在生成的 slide sid
  selectedImageIndex: number;  // 当前选中的图片索引
  error: string | null;

  // Current project slug
  selectedProjectSlug: string | null;

  // Actions
  loadSlides: (projectSlug?: string) => Promise<void>;
  createSlide: (text?: string, projectSlug?: string) => Promise<void>;
  updateSlide: (sid: string, text: string) => Promise<void>;
  updateSlideFull: (sid: string, text: string, title?: string, thumbnail?: string) => Promise<void>;
  deleteSlide: (sid: string) => Promise<void>;
  selectSlide: (sid: string | null) => void;
  selectImage: (index: number) => void;
  generateImage: (sid: string, text: string, provider?: 'gemini' | 'minimax', projectSlug?: string) => Promise<void>;
  loadImages: (sid: string, projectSlug?: string) => Promise<void>;
  deleteImage: (sid: string, hash: string) => Promise<void>;
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
  generatingSid: null,
  selectedImageIndex: 0,
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

  createSlide: async (text = '新幻灯片', projectSlug?: string) => {
    const slug = projectSlug || get().selectedProjectSlug || 'default';
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

  updateSlideFull: async (sid: string, text: string, title?: string, thumbnail?: string) => {
    const { selectedProjectSlug } = get();
    const slug = selectedProjectSlug || 'default';
    try {
      await slidesApi.update(slug, sid, text, title, thumbnail);
      set(state => ({
        slides: state.slides.map(s =>
          s.sid === sid ? { ...s, text, ...(title !== undefined && { title }), ...(thumbnail !== undefined && { thumbnail }) } : s
        )
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
    set({ selectedSid: sid, selectedImageIndex: 0 });
    if (sid) {
      get().loadImages(sid, get().selectedProjectSlug || 'default');
    }
  },

  selectImage: async (index: number) => {
    const state = get();
    const slideImages = state.selectedSid ? state.images[state.selectedSid] || [] : [];
    const selectedImage = slideImages[index];

    // 更新内存中的索引
    set({ selectedImageIndex: index });

    // 如果有选中的图片，保存为 slide 的 thumbnail (只存hash)
    if (selectedImage && state.selectedSid && state.selectedProjectSlug) {
      const slideIndex = state.slides.findIndex(s => s.sid === state.selectedSid);
      if (slideIndex !== -1) {
        const slide = state.slides[slideIndex];
        // 从 URL 中提取 hash
        const hash = selectedImage.hash;
        // 更新本地 state
        set(s => ({
          slides: s.slides.map((sl, i) =>
            i === slideIndex ? { ...sl, thumbnail: hash } : sl
          )
        }));
        // 保存到后端
        await slidesApi.update(state.selectedProjectSlug, state.selectedSid, slide.text, slide.title || undefined, hash);

        // 如果更新的是第一个 slide，同步更新 projectsStore 的封面
        if (slideIndex === 0 && state.selectedProjectSlug) {
          const newThumbnailUrl = `/api/projects/${state.selectedProjectSlug}/thumbnail`;
          useProjectsStore.getState().updateProjectThumbnail(state.selectedProjectSlug, newThumbnailUrl);
        }
      }
    }
  },

  generateImage: async (sid: string, text: string, provider = 'minimax', projectSlug?: string) => {
    const slug = projectSlug || get().selectedProjectSlug || 'default';
    set({ isLoading: true, generatingSid: sid, error: null });
    try {
      const result = await slidesApi.generate(slug, sid, text, provider, true);
      const state = get();
      set(state => {
        const newImages = { ...state.images };
        newImages[sid] = [
          { hash: result.hash, url: result.image_url, cached: result.cached },
          ...(newImages[sid] || []).filter(i => i.hash !== result.hash)
        ];
        return { images: newImages, isLoading: false, generatingSid: null, selectedImageIndex: 0 };
      });
      // 更新 slide 的 thumbnail 和 title
      const slide = state.slides.find(s => s.sid === sid);
      // 使用 slug 而非 state.selectedProjectSlug，因为后者可能在 loadSlides 未完成时为 null
      if (slide && slug) {
        // 提取新标题，如果失败则使用文本前20字
        let newTitle: string | undefined;
        try {
          console.log('Calling extractTitle with text:', text.slice(0, 50), '...');
          const titleResult = await slidesApi.extractTitle(slug, sid, text);
          console.log('extractTitle result:', titleResult);
          newTitle = titleResult.title || text.slice(0, 20);
        } catch (e) {
          console.warn('Failed to extract title, using fallback:', e);
          newTitle = text.slice(0, 20);
        }
        console.log('Updating slide with title:', newTitle);
        // 总是更新 title（即使失败也用 fallback）
        await slidesApi.update(slug, sid, text, newTitle, result.hash);
        // 更新本地 slides state
        set(s => ({
          slides: s.slides.map(sl =>
            sl.sid === sid ? { ...sl, thumbnail: result.hash, title: newTitle } : sl
          )
        }));
      } else {
        console.log('Skipping title update: slide=', slide, 'projectSlug=', state.selectedProjectSlug);
      }
      get().loadCost();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false, generatingSid: null });
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

  deleteImage: async (sid: string, hash: string) => {
    const { selectedProjectSlug } = get();
    const slug = selectedProjectSlug || 'default';
    try {
      await slidesApi.deleteImage(slug, sid, hash);
      // 从本地状态移除图片
      set(state => {
        const slideImages = state.images[sid] || [];
        const newImages = slideImages.filter(img => img.hash !== hash);
        // 如果删除的是当前选中的图片，需要调整 selectedImageIndex
        let newSelectedIndex = state.selectedImageIndex;
        if (state.selectedSid === sid && newImages.length > 0) {
          if (newSelectedIndex >= newImages.length) {
            newSelectedIndex = newImages.length - 1;
          }
        }
        return {
          images: { ...state.images, [sid]: newImages },
          selectedImageIndex: newSelectedIndex
        };
      });
    } catch (err) {
      console.error('Failed to delete image:', err);
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
    const { selectedSid, slides, selectedProjectSlug } = get();
    const slug = selectedProjectSlug || 'default';
    const startIndex = slides.findIndex(s => s.sid === selectedSid) ?? 0;

    try {
      const data = await playbackApi.getSlides(slug, startIndex);
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