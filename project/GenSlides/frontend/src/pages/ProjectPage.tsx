import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSlidesStore } from '../stores/slidesStore';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import MainPreview from '../components/MainPreview';
import FullscreenPlayer from '../components/FullscreenPlayer';

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const { loadSlides, loadCost, cost, isPlaying } = useSlidesStore();

  useEffect(() => {
    if (slug) {
      loadSlides(slug);
      loadCost();
    }
  }, [slug, loadSlides, loadCost]);

  return (
    <div className="min-h-screen bg-text-primary">
      {/* 背景全屏预览 */}
      <MainPreview projectSlug={slug} />

      {/* 顶部悬浮 Header */}
      <Header projectSlug={slug} />

      {/* 左侧悬浮侧边栏 */}
      <div className="absolute left-0 top-16 bottom-10 w-64 z-30">
        <Sidebar projectSlug={slug} />
      </div>

      {/* 右下角悬浮成本显示 */}
      <footer className="fixed bottom-4 right-4 z-30 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg text-xs text-text-primary/60 flex gap-4">
        <span>Gemini: ${cost?.gemini_cost.toFixed(4) || '0.0000'}</span>
        <span>MiniMax: ${cost?.minimax_cost.toFixed(4) || '0.0000'}</span>
        <span className="text-text-primary font-medium">${cost?.total_cost.toFixed(4) || '0.0000'}</span>
      </footer>

      {/* Fullscreen Player */}
      {isPlaying && <FullscreenPlayer />}
    </div>
  );
}
