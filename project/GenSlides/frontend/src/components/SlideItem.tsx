import { useState } from 'react';
import type { Slide } from '../types';
import { useSlidesStore } from '../stores/slidesStore';

interface SlideItemProps {
  slide: Slide;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export default function SlideItem({ slide, isSelected, onSelect, onDelete }: SlideItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(slide.text);
  const { updateSlide } = useSlidesStore();

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditText(slide.text);
  };

  const handleConfirm = () => {
    if (editText.trim() && editText !== slide.text) {
      updateSlide(slide.sid, editText.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(slide.text);
    }
  };

  return (
    <div
      className={`p-3 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'bg-blue-600 text-white'
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium opacity-75">Slide {slide.sid.slice(0, 6)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-xs opacity-50 hover:opacity-100 hover:text-red-400"
        >
          ×
        </button>
      </div>

      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleConfirm}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="w-full px-2 py-1 text-sm bg-gray-900 border border-blue-400 rounded text-white focus:outline-none"
          autoFocus
        />
      ) : (
        <p
          className="text-sm truncate"
          onDoubleClick={handleDoubleClick}
          title="双击编辑"
        >
          {slide.text}
        </p>
      )}
    </div>
  );
}
