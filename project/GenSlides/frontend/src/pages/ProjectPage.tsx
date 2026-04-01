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
    <div className="min-h-screen bg-gray-950">
      <Header projectSlug={slug} />

      <div className="flex h-[calc(100vh-64px)]">
        <Sidebar projectSlug={slug} />
        <main className="flex-1 p-6 overflow-auto">
          <MainPreview projectSlug={slug} />
        </main>
      </div>

      {/* Cost display */}
      <footer className="fixed bottom-0 left-0 right-0 px-6 py-2 bg-gray-900 border-t border-gray-700 text-xs text-gray-500 flex justify-end gap-6">
        <span>Gemini: ${cost?.gemini_cost.toFixed(4) || '0.0000'}</span>
        <span>MiniMax: ${cost?.minimax_cost.toFixed(4) || '0.0000'}</span>
        <span className="text-white font-medium">Total: ${cost?.total_cost.toFixed(4) || '0.0000'}</span>
      </footer>

      {/* Fullscreen Player */}
      {isPlaying && <FullscreenPlayer />}
    </div>
  );
}