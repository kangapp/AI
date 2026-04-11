import { useState } from 'react';
import type { Slide } from '../types';
import { slidesApi } from '../api';
import { useSlidesStore } from '../stores/slidesStore';

interface SlideEditModalProps {
  slide: Slide;
  projectSlug: string;
  onClose: () => void;
}

export default function SlideEditModal({ slide, projectSlug, onClose }: SlideEditModalProps) {
  const [text, setText] = useState(slide.text);
  const { generateImage } = useSlidesStore();

  const handleGenerate = async () => {
    try {
      // 先保存编辑的文本
      await slidesApi.update(projectSlug, slide.sid, text);
      // 关闭弹窗
      onClose();
      // 后台生成图片，传递最新文本
      generateImage(slide.sid, text, 'minimax', projectSlug);
    } catch (err) {
      console.error('Failed to save before generate:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-hard" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-text-primary">编辑</h2>
          <button onClick={onClose} className="text-text-primary/60 hover:text-text-primary text-xl">×</button>
        </div>

        {/* 文本内容 */}
        <div className="mb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-bg-light rounded-lg text-sm text-text-primary border border-text-primary/10 resize-none focus:outline-none focus:border-primary"
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-text-primary font-medium rounded-lg transition-colors"
          >
            生成图片
          </button>
        </div>
      </div>
    </div>
  );
}
