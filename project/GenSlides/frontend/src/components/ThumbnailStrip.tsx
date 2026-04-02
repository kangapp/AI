import { useSlidesStore } from '../stores/slidesStore';

export default function ThumbnailStrip() {
  const { selectedSid, images, generatingSid } = useSlidesStore();
  const slideImages = selectedSid ? images[selectedSid] || [] : [];
  const isGenerating = generatingSid === selectedSid;

  if (slideImages.length === 0 && !isGenerating) {
    return (
      <div className="flex items-center justify-center h-32 bg-bg-light rounded-lg">
        <p className="text-text-primary/40 text-sm">暂无生成图片</p>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="flex items-center justify-center h-32 bg-bg-light rounded-lg">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin"></div>
          <p className="text-text-primary/40 text-sm">生成中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {slideImages.map((img) => (
        <div
          key={img.hash}
          className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-bg-light border-2 border-transparent hover:border-primary cursor-pointer transition-colors"
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
