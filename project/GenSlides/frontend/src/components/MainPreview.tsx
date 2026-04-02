import { useState } from 'react';
import { useSlidesStore } from '../stores/slidesStore';
import ThumbnailStrip from './ThumbnailStrip';

interface MainPreviewProps {
  projectSlug?: string;
}

export default function MainPreview({ projectSlug }: MainPreviewProps) {
  const { selectedSid, slides, images, generateImage, generatingSid } = useSlidesStore();
  const [provider, setProvider] = useState<'minimax' | 'gemini'>('minimax');
  const [showControls, setShowControls] = useState(true);
  const slug = projectSlug || 'default';

  const selectedSlide = slides.find(s => s.sid === selectedSid);
  const slideImages = selectedSid ? images[selectedSid] || [] : [];
  const isGenerating = generatingSid === selectedSid;

  const mainImage = slideImages[0];

  const handleGenerate = () => {
    if (selectedSid) {
      generateImage(selectedSid, provider, slug);
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
      className="relative w-full h-full overflow-hidden"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* 主图片 - 全屏铺满 */}
      {isGenerating ? (
        <div className="absolute inset-0 flex items-center justify-center bg-text-primary/60 z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-medium">生成中...</p>
          </div>
        </div>
      ) : mainImage ? (
        <img
          src={mainImage.url}
          alt={selectedSlide.text}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-text-primary/20 to-text-primary/10" />
      )}

      {/* 顶部悬浮 - Provider 选择 */}
      <div className={`absolute top-4 right-4 z-20 transition-all duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg">
          <button
            onClick={() => setProvider('minimax')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              provider === 'minimax'
                ? 'bg-primary text-text-primary'
                : 'text-text-primary/60 hover:bg-primary/20'
            }`}
          >
            MiniMax
          </button>
          <button
            onClick={() => setProvider('gemini')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              provider === 'gemini'
                ? 'bg-primary text-text-primary'
                : 'text-text-primary/60 hover:bg-primary/20'
            }`}
          >
            Gemini
          </button>
        </div>
      </div>

      {/* 右下角悬浮 - 缩略图 */}
      <div className={`absolute bottom-4 right-4 z-20 transition-all duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-2">
          <ThumbnailStrip />
        </div>
      </div>

      {/* 底部渐变信息 - 避开底部 footer */}
      <div className="absolute bottom-10 left-0 right-0 z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-12 pb-3 px-6">
        <p className="text-white text-lg font-medium truncate">{selectedSlide.text}</p>
        {selectedSlide.title && (
          <p className="text-white/60 text-sm mt-0.5">{selectedSlide.title}</p>
        )}
      </div>

      {/* 无图片时提示 - 居中显示 */}
      {!mainImage && !isGenerating && showControls && (
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
