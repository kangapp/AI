import { useSlidesStore } from '../stores/slidesStore';

export default function ThumbnailStrip() {
  const { selectedSid, images, generatingSid } = useSlidesStore();
  const slideImages = selectedSid ? images[selectedSid] || [] : [];
  const isGenerating = generatingSid === selectedSid;

  if (slideImages.length === 0 && !isGenerating) {
    return (
      <div className="h-14 flex items-center justify-center">
        <p className="text-text-primary/40 text-xs">暂无图片</p>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="h-14 flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin"></div>
        <p className="text-text-primary/60 text-xs">生成中...</p>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto max-w-48">
      {slideImages.map((img) => (
        <div
          key={img.hash}
          className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-text-primary/10 border-2 border-transparent hover:border-primary cursor-pointer transition-colors"
        >
          <img
            src={img.url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}
