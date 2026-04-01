import { useSlidesStore } from '../stores/slidesStore';
import ThumbnailStrip from './ThumbnailStrip';

export default function MainPreview() {
  const { selectedSid, slides, images, generateImage, isLoading } = useSlidesStore();

  const selectedSlide = slides.find(s => s.sid === selectedSid);
  const slideImages = selectedSid ? images[selectedSid] || [] : [];

  // Get main image (first one, or the one matching current text hash)
  const mainImage = slideImages[0];

  if (!selectedSlide) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 rounded-xl">
        <p className="text-gray-500">选择或创建一个幻灯片</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Main Image Area */}
      <div className="flex-1 bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center relative">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">生成中...</p>
          </div>
        ) : mainImage ? (
          <img
            src={mainImage.url}
            alt={selectedSlide.text}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-center">
            <p className="text-gray-400 mb-4">图片根据当前 slide 文字内容生成</p>
            <button
              onClick={() => selectedSid && generateImage(selectedSid)}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              生成图片
            </button>
          </div>
        )}

        {/* Slide text overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <p className="text-white text-lg">{selectedSlide.text}</p>
        </div>
      </div>

      {/* Thumbnail Strip */}
      <div className="mt-4">
        <p className="text-xs text-gray-500 mb-2">底下有缩略图，用户可以切换预览</p>
        <ThumbnailStrip />
      </div>
    </div>
  );
}
