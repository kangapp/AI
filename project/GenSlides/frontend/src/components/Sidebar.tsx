import { useSlidesStore } from '../stores/slidesStore';
import SlideItem from './SlideItem';

interface SidebarProps {
  projectSlug?: string;
}

export default function Sidebar(_props: SidebarProps) {
  const { slides, selectedSid, selectSlide, deleteSlide, createSlide, generateImage } = useSlidesStore();

  const handleCreate = async () => {
    await createSlide('新幻灯片');
    // Generate image for new slide automatically
    const newSid = useSlidesStore.getState().selectedSid;
    if (newSid) {
      generateImage(newSid);
    }
  };

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-400">Slides</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {slides.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">暂无幻灯片</p>
        ) : (
          slides.map((slide) => (
            <SlideItem
              key={slide.sid}
              slide={slide}
              isSelected={slide.sid === selectedSid}
              onSelect={() => selectSlide(slide.sid)}
              onDelete={() => deleteSlide(slide.sid)}
            />
          ))
        )}
      </div>

      <div className="p-3 border-t border-gray-700">
        <button
          onClick={handleCreate}
          className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
        >
          + 新建 Slide
        </button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          当用户点击一个 slide 下面一点时，会在当前 slide 下创建一个新的
        </p>
      </div>
    </aside>
  );
}
