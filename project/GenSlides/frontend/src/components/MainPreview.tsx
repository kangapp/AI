import { useState } from 'react';
import { useSlidesStore } from '../stores/slidesStore';
import ThumbnailStrip from './ThumbnailStrip';

interface MainPreviewProps {
  projectSlug?: string;
}

export default function MainPreview({ projectSlug }: MainPreviewProps) {
  const { selectedSid, slides, images, generateImage, selectedImageIndex, selectImage } = useSlidesStore();
  const [provider, setProvider] = useState<'minimax' | 'gemini'>('minimax');
  const [showControls, setShowControls] = useState(true);
  const slug = projectSlug || 'default';

  const selectedSlide = slides.find(s => s.sid === selectedSid);
  const slideImages = selectedSid ? images[selectedSid] || [] : [];

  // 优先使用 slide.thumbnail 对应的图片，否则用选中的图片
  const mainImage = selectedSlide?.thumbnail
    ? slideImages.find(img => img.hash === selectedSlide.thumbnail) || slideImages[selectedImageIndex]
    : slideImages[selectedImageIndex];

  const handleGenerate = () => {
    if (selectedSid && selectedSlide) {
      generateImage(selectedSid, selectedSlide.text, provider, slug);
    }
  };

  if (!selectedSlide) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-text-primary/10">
        <p className="text-text-primary/50">选择或创建一个幻灯片</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* 主图片 - 铺满显示 */}
      <div className="absolute inset-px top-px left-2 right-px bottom-[42px] flex items-center justify-center">
        {mainImage ? (
          <img
            src={mainImage.url}
            alt={selectedSlide.text}
            className="w-full h-full object-cover rounded-lg ring-2 ring-primary shadow-hard"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-bg-light to-text-primary/10 rounded-lg ring-2 ring-primary/30 shadow-hard flex items-center justify-center">
            <span className="text-text-primary/20 text-4xl font-light">+</span>
          </div>
        )}
      </div>

      {/* 右上角 - Provider 选择 */}
      <div className={`absolute top-4 right-4 z-20 transition-all duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-xl rounded-full px-3 py-2 shadow-2xl border border-white/30">
          <button
            onClick={() => setProvider('minimax')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
              provider === 'minimax'
                ? 'bg-primary text-text-primary shadow-sm'
                : 'text-white/90 hover:bg-white/20'
            }`}
          >
            MiniMax
          </button>
          <button
            onClick={() => setProvider('gemini')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
              provider === 'gemini'
                ? 'bg-primary text-text-primary shadow-sm'
                : 'text-white/90 hover:bg-white/20'
            }`}
          >
            Gemini
          </button>
        </div>
      </div>

      {/* 右侧 - 缩略图垂直排列居中 */}
      <div className={`absolute top-1/2 -translate-y-1/2 right-4 z-20 transition-all duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex flex-col items-center gap-2 bg-black/40 backdrop-blur-xl rounded-2xl p-2 shadow-2xl border border-white/30">
          <ThumbnailStrip onSelectImage={selectImage} />
        </div>
      </div>

      {/* 底部文字信息 */}
      <div className="absolute bottom-12 left-0 right-0 z-10 px-6 pb-3 pointer-events-none">
        <div className="inline-block bg-text-primary/80 backdrop-blur-sm rounded-lg px-4 py-2 shadow-hard">
          <p className="text-white text-lg font-medium truncate">{selectedSlide.text}</p>
          {selectedSlide.title && (
            <p className="text-white/60 text-sm mt-0.5">{selectedSlide.title}</p>
          )}
        </div>
      </div>

      {/* 无图片时提示 - 居中显示 */}
      {!mainImage && showControls && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 text-center">
            <p className="text-text-primary/70 text-sm mb-3">点击按钮生成图片</p>
            <button
              onClick={handleGenerate}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-text-primary text-sm font-medium rounded-xl shadow transition-all hover:scale-105"
            >
              生成图片
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
