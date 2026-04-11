import { useState } from 'react';
import { useSlidesStore } from '../stores/slidesStore';

interface ThumbnailStripProps {
  onSelectImage?: (index: number) => void;
}

export default function ThumbnailStrip({ onSelectImage }: ThumbnailStripProps) {
  const { selectedSid, images, generatingSid, selectedImageIndex, deleteImage } = useSlidesStore();
  const slideImages = selectedSid ? images[selectedSid] || [] : [];
  const isGenerating = generatingSid === selectedSid;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (slideImages.length === 0 && !isGenerating) {
    return (
      <div className="h-14 flex items-center justify-center">
        <p className="text-text-primary/40 text-xs">暂无图片</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 overflow-y-auto max-h-80 w-14">
      {/* 生成中时的加载指示器 - 显示在第一位 */}
      {isGenerating && (
        <div className="w-full h-14 rounded overflow-hidden flex items-center justify-center bg-bg-light ring-2 ring-primary">
          <div className="w-5 h-5 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin"></div>
        </div>
      )}
      {slideImages.map((img, index) => (
        <div
          key={img.hash}
          onClick={() => onSelectImage?.(index)}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          className={`relative w-full h-14 rounded overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-white/50 ${
            index === selectedImageIndex && !isGenerating
              ? 'ring-2 ring-primary shadow-md'
              : ''
          }`}
        >
          <img
            src={img.url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {hoveredIndex === index && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (selectedSid) {
                  deleteImage(selectedSid, img.hash);
                }
              }}
              className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 hover:bg-red-500 text-white text-xs rounded-full flex items-center justify-center opacity-80 hover:opacity-100 transition-all"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
