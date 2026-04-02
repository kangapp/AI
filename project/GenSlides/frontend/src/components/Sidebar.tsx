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
    <aside className="w-64 h-full bg-white/95 backdrop-blur-sm rounded-r-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="p-4 border-b border-text-primary/10">
        <h2 className="text-sm font-semibold text-text-primary">Slides</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
          className="w-full py-2 bg-primary hover:bg-primary/90 text-text-primary rounded-lg text-sm font-medium transition-colors"
        >
          + 新建 Slide
        </button>
      </div>
    </aside>
  );
}
