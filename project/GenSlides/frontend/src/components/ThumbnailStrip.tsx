import { useSlidesStore } from '../stores/slidesStore';

export default function ThumbnailStrip() {
  const { selectedSid, images } = useSlidesStore();
  const slideImages = selectedSid ? images[selectedSid] || [] : [];

  if (slideImages.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-800 rounded-lg">
        <p className="text-gray-500 text-sm">暂无生成图片</p>
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {slideImages.map((img) => (
        <div
          key={img.hash}
          className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-gray-800 border-2 border-transparent hover:border-blue-500 cursor-pointer transition-colors"
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
