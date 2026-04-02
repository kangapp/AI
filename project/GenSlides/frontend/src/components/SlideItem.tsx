import { useState } from 'react';
import type { Slide } from '../types';
import { useSlidesStore } from '../stores/slidesStore';
import SlideEditModal from './SlideEditModal';

interface SlideItemProps {
  slide: Slide;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export default function SlideItem({ slide, isSelected, onSelect, onDelete }: SlideItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { updateSlideFull, images } = useSlidesStore();

  // 获取缩略图: 优先使用 slide.thumbnail，否则使用第一张生成的图片
  const getThumbnail = () => {
    if (slide.thumbnail) {
      return slide.thumbnail;
    }
    const slideImages = images[slide.sid] || [];
    return slideImages[0]?.url || null;
  };

  const thumbnail = getThumbnail();
  const displayTitle = slide.title || slide.text.slice(0, 30);

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
        className={`p-3 rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'bg-primary text-text-primary'
            : 'bg-bg-light text-text-primary/70 hover:bg-primary/20'
        }`}
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
      >
        <div className="flex items-center gap-3">
          {/* 缩略图 */}
          {thumbnail ? (
            <div className="w-16 h-9 rounded overflow-hidden flex-shrink-0 bg-text-primary/10">
              <img src={thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-9 rounded flex-shrink-0 bg-text-primary/10 flex items-center justify-center">
              <span className="text-text-primary/30 text-xs">无图</span>
            </div>
          )}

          {/* 标题和状态 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayTitle}</p>
            {thumbnail && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                已生成
              </span>
            )}
          </div>

          {/* 删除按钮 */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-xs opacity-50 hover:opacity-100 hover:text-red-500"
          >
            ×
          </button>
        </div>
      </div>

      {/* 编辑弹窗 */}
      {isEditing && (
        <SlideEditModal
          slide={slide}
          projectSlug={useSlidesStore.getState().selectedProjectSlug || 'default'}
          onClose={() => setIsEditing(false)}
          onSave={handleSaveEdit}
        />
      )}
    </>
  );
}
