import { useSlidesStore } from '../stores/slidesStore';
import SlideItem from './SlideItem';

interface SidebarProps {
  projectSlug?: string;
}

export default function Sidebar({ projectSlug }: SidebarProps) {
  const { slides, selectedSid, selectSlide, deleteSlide, createSlide } = useSlidesStore();
  const slug = projectSlug || 'default';

  const handleCreate = async () => {
    await createSlide('新幻灯片', slug);
  };

  return (
    <aside className="w-64 bg-white border-r border-text-primary/10 flex flex-col h-full">
      <div className="p-4 border-b border-text-primary/10">
        <h2 className="text-sm font-semibold text-text-primary">Slides</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
        {slides.length === 0 ? (
          <p className="text-sm text-text-primary/50 text-center py-8">暂无幻灯片</p>
        ) : (
          slides.map((slide, index) => (
            <SlideItem
              key={slide.sid}
              slide={slide}
              index={index + 1}
              isSelected={slide.sid === selectedSid}
              onSelect={() => selectSlide(slide.sid)}
              onDelete={() => deleteSlide(slide.sid)}
              projectSlug={projectSlug}
            />
          ))
        )}
      </div>

      <div className="p-3 border-t border-text-primary/10">
        <button
          onClick={handleCreate}
          className="w-full py-2 bg-bg-light hover:bg-primary/20 text-text-primary rounded-lg text-sm font-medium transition-colors"
        >
          + 新建 Slide
        </button>
        <p className="text-xs text-text-primary/40 mt-2 text-center">
          点击按钮创建新幻灯片
        </p>
      </div>
    </aside>
  );
}
