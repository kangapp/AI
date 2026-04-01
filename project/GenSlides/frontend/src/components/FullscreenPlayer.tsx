import { useEffect, useCallback } from 'react';
import { useSlidesStore } from '../stores/slidesStore';

const SLIDE_INTERVAL = 5000; // 5 seconds per slide

export default function FullscreenPlayer() {
  const {
    isPlaying,
    playbackSlides,
    playbackIndex,
    nextSlide,
    prevSlide,
    exitPlayback
  } = useSlidesStore();

  const currentSlide = playbackSlides[playbackIndex];

  // Auto-advance slides
  useEffect(() => {
    if (!isPlaying || playbackSlides.length === 0) return;

    const timer = setInterval(() => {
      nextSlide();
    }, SLIDE_INTERVAL);

    return () => clearInterval(timer);
  }, [isPlaying, playbackIndex, playbackSlides.length, nextSlide]);

  // Keyboard controls
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
        nextSlide();
        break;
      case 'ArrowLeft':
        prevSlide();
        break;
      case ' ':
        // Space - could implement pause
        break;
      case 'Escape':
        exitPlayback();
        break;
    }
  }, [nextSlide, prevSlide, exitPlayback]);

  useEffect(() => {
    if (isPlaying) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isPlaying, handleKeyDown]);

  if (!isPlaying || !currentSlide) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onClick={exitPlayback}
    >
      {/* Main Image */}
      <div className="relative w-full h-full flex items-center justify-center">
        {currentSlide.main_image_url ? (
          <img
            src={currentSlide.main_image_url}
            alt={currentSlide.text}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <p className="text-gray-400 text-xl">{currentSlide.text}</p>
        )}
      </div>

      {/* Text overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
        <p className="text-white text-2xl text-center">{currentSlide.text}</p>
        <p className="text-gray-400 text-sm text-center mt-2">
          {playbackIndex + 1} / {playbackSlides.length}
        </p>
      </div>

      {/* Controls hint */}
      <div className="absolute top-4 right-4 text-gray-500 text-sm">
        ESC 退出 | ← → 切换
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${((playbackIndex + 1) / playbackSlides.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
