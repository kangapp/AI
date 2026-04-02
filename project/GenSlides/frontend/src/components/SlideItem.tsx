import { useState } from 'react';
import type { Slide } from '../types';
import { useSlidesStore } from '../stores/slidesStore';
import SlideEditModal from './SlideEditModal';

interface SlideItemProps {
  slide: Slide;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  projectSlug?: string;
}

export default function SlideItem({ slide, index, isSelected, onSelect, onDelete, projectSlug }: SlideItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { updateSlideFull, images, generatingSid } = useSlidesStore();
  const isGenerating = generatingSid === slide.sid;

  const getThumbnail = () => {
    if (slide.thumbnail) {
      return slide.thumbnail;
    }
    const slideImages = images[slide.sid] || [];
    return slideImages[0]?.url || null;
  };

  const thumbnail = getThumbnail();
  const displayTitle = slide.title || slide.text.slice(0, 20);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSaveEdit = (updatedSlide: Slide) => {
    updateSlideFull(updatedSlide.sid, updatedSlide.text, updatedSlide.title, updatedSlide.thumbnail);
    setIsEditing(false);
  };

  return (
    <>
      <div
        className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${
          isSelected
            ? 'ring-2 ring-primary shadow-hard'
            : 'hover:shadow-md'
        }`}
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
      >
        {/* 卡片背景 */}
        <div className={`aspect-video ${isSelected ? 'bg-primary' : 'bg-bg-light'}`}>
          {/* 加载动画 */}
          {isGenerating ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-text-primary/20 border-t-text-primary rounded-full animate-spin"></div>
            </div>
          ) : thumbnail ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-text-primary/20 text-3xl font-light">+</span>
            </div>
          )}
        </div>

        {/* 底部信息栏 */}
        <div className={`absolute bottom-0 left-0 right-0 px-2 py-1.5 flex items-end justify-between ${
          isSelected ? 'bg-primary' : 'bg-text-primary/60'
        }`}>
          {/* 标题 - 左下 */}
          <span className={`text-xs font-medium truncate max-w-[70%] ${
            isSelected ? 'text-text-primary' : 'text-white/90'
          }`}>
            {displayTitle}
          </span>

          {/* 序号 - 右下 */}
          <span className={`text-xs font-mono ${
            isSelected ? 'text-text-primary/60' : 'text-white/50'
          }`}>
            {String(index).padStart(2, '0')}
          </span>
        </div>

        {/* 删除按钮 */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-opacity hover:opacity-100 ${
            isSelected ? 'bg-text-primary/60 text-white' : 'bg-text-primary/40 text-white/80'
          } opacity-0 group-hover:opacity-100`}
        >
          ×
        </button>
      </div>

      {/* 编辑弹窗 */}
      {isEditing && (
        <SlideEditModal
          slide={slide}
          projectSlug={projectSlug || useSlidesStore.getState().selectedProjectSlug || 'default'}
          onClose={() => setIsEditing(false)}
          onSave={handleSaveEdit}
        />
      )}
    </>
  );
}
