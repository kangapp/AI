import { useState } from 'react';
import type { Slide } from '../types';
import { slidesApi } from '../api';
import { useSlidesStore } from '../stores/slidesStore';

interface SlideEditModalProps {
  slide: Slide;
  projectSlug: string;
  onClose: () => void;
  onSave: (updatedSlide: Slide) => void;
}

export default function SlideEditModal({ slide, projectSlug, onClose, onSave }: SlideEditModalProps) {
  const [text, setText] = useState(slide.text);
  const [title, setTitle] = useState(slide.title || '');
  const [provider, setProvider] = useState<'minimax' | 'gemini'>('minimax');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(slide.thumbnail || null);
  const { generateImage } = useSlidesStore();

  const handleGenerate = async () => {
    // 立即关闭弹窗
    onClose();

    // 触发后台生成
    try {
      // 生成图片 (后台异步)
      const result = await slidesApi.generate(projectSlug, slide.sid, provider, true);
      setGeneratedImageUrl(result.image_url);

      // 自动提取标题
      try {
        const titleResult = await slidesApi.extractTitle(projectSlug, slide.sid, text);
        setTitle(titleResult.title);
        // 同时更新 slide 的 title
        await slidesApi.update(projectSlug, slide.sid, text, titleResult.title, result.image_url);
        onSave({ ...slide, text, title: titleResult.title, thumbnail: result.image_url });
      } catch (err) {
        console.error('Failed to extract title:', err);
        // 即使标题提取失败，也保存图片
        await slidesApi.update(projectSlug, slide.sid, text, undefined, result.image_url);
        onSave({ ...slide, text, thumbnail: result.image_url });
      }
    } catch (err) {
      console.error('Failed to generate image:', err);
    }
  };

  const handleSave = async () => {
    try {
      const updated = await slidesApi.update(
        projectSlug,
        slide.sid,
        text,
        title || undefined,
        generatedImageUrl || undefined
      );
      onSave(updated);
      onClose();
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-text-primary/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-hard">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-text-primary">编辑 Slide</h2>
          <button onClick={onClose} className="text-text-primary/60 hover:text-text-primary text-2xl">×</button>
        </div>

        <div className="space-y-4">
          {/* Provider */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-primary/70">Provider:</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'minimax' | 'gemini')}
              className="px-3 py-1.5 bg-bg-light rounded-lg text-sm text-text-primary border border-text-primary/10"
            >
              <option value="minimax">MiniMax</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>

          {/* Text Content */}
          <div>
            <label className="block text-sm font-medium text-text-primary/70 mb-1">文本内容</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-bg-light rounded-lg text-sm text-text-primary border border-text-primary/10 resize-none focus:outline-none focus:border-primary"
            />
          </div>

          {/* Title Display */}
          {title && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-primary/70">标题:</span>
              <span className="text-sm font-medium text-text-primary">{title}</span>
            </div>
          )}

          <hr className="border-text-primary/10" />

          {/* Image Generation */}
          <div>
            <label className="block text-sm font-medium text-text-primary/70 mb-2">图片生成</label>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-text-primary rounded-lg text-sm font-medium transition-colors"
            >
              生成图片
            </button>
            <p className="text-xs text-text-primary/50 mt-1">生成后将自动关闭弹窗</p>
          </div>

          {/* Existing Image Preview */}
          {generatedImageUrl && (
            <div className="mt-2">
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-bg-light">
                <img src={generatedImageUrl} alt="Current" className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-text-primary/50 mt-1">当前展示图</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-primary/60 hover:text-text-primary transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-text-primary font-medium rounded-lg transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
