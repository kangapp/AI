import { useState } from 'react';
import { useSlidesStore } from '../stores/slidesStore';
import ThumbnailStrip from './ThumbnailStrip';

interface MainPreviewProps {
  projectSlug?: string;
}

export default function MainPreview({ projectSlug }: MainPreviewProps) {
  const { selectedSid, slides, images, generateImage, generatingSid } = useSlidesStore();
  const [provider, setProvider] = useState<'minimax' | 'gemini'>('minimax');
  const [showControls, setShowControls] = useState(false);
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
      <div className="relative w-full h-full bg-text-primary flex items-center justify-center">
        <p className="text-white/50">选择或创建一个幻灯片</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-text-primary"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* 主图片 - 全屏铺满 */}
      {isGenerating ? (
        <div className="absolute inset-0 flex items-center justify-center bg-text-primary/80 z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-medium">生成中...</p>
          </div>
        </div>
      ) : mainImage ? (
        <img
          src={mainImage.url}
          alt={selectedSlide.text}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-text-primary to-text-primary/80" />
      )}

      {/* 顶部悬浮 - Provider 选择器 */}
      <div className={`absolute top-4 left-4 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg">
          <span className="text-xs text-text-primary/60">Provider:</span>
          <div className="flex rounded-lg overflow-hidden border border-text-primary/10">
            <button
              onClick={() => setProvider('minimax')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                provider === 'minimax'
                  ? 'bg-primary text-text-primary'
                  : 'bg-white text-text-primary/70 hover:bg-primary/20'
              }`}
            >
              MiniMax
            </button>
            <button
              onClick={() => setProvider('gemini')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                provider === 'gemini'
                  ? 'bg-primary text-text-primary'
                  : 'bg-white text-text-primary/70 hover:bg-primary/20'
              }`}
            >
              Gemini
            </button>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-text-primary text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            生成
          </button>
        </div>
      </div>

      {/* 右下角悬浮 - 缩略图 */}
      <div className={`absolute bottom-4 right-4 z-20 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-2 max-w-xs">
          <ThumbnailStrip />
        </div>
      </div>

      {/* 底部渐变信息栏 */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-16 pb-4 px-4">
        <p className="text-white text-lg font-medium truncate">{selectedSlide.text}</p>
        {selectedSlide.title && (
          <p className="text-white/60 text-sm mt-1">{selectedSlide.title}</p>
        )}
      </div>

      {/* 左下角悬浮 - 无图片提示 */}
      {!mainImage && !isGenerating && (
        <div className={`absolute bottom-20 left-4 z-20 transition-all duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 text-center">
            <p className="text-text-primary/70 text-sm mb-2">暂无图片</p>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-text-primary text-sm font-medium rounded-lg transition-colors"
            >
              生成图片
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
