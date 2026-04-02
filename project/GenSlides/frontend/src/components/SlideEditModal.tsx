import { useState } from 'react';
import type { Slide } from '../types';
import { slidesApi } from '../api';

interface SlideEditModalProps {
  slide: Slide;
  projectSlug: string;
  onClose: () => void;
  onSave: (updatedSlide: Slide) => void;
}

type ModalState = 'idle' | 'generating' | 'saving';

export default function SlideEditModal({ slide, projectSlug, onClose, onSave }: SlideEditModalProps) {
  const [text, setText] = useState(slide.text);
  const [title, setTitle] = useState(slide.title || '');
  const [provider, setProvider] = useState<'minimax' | 'gemini'>('minimax');
  const [state, setState] = useState<ModalState>('idle');
  const [generatedImage, setGeneratedImage] = useState<{ hash: string; url: string } | null>(
    slide.thumbnail ? { hash: '', url: slide.thumbnail } : null
  );

  const handleGenerate = async () => {
    setState('generating');
    try {
      // 生成 1 张图片
      const results = await slidesApi.generateMultipleImages(projectSlug, slide.sid, provider, 1);
      if (results.length > 0) {
        const img = results[0];
        setGeneratedImage({ hash: img.hash, url: img.image_url });

        // 自动提取标题
        try {
          const titleResult = await slidesApi.extractTitle(projectSlug, slide.sid, text);
          setTitle(titleResult.title);
        } catch (err) {
          console.error('Failed to extract title:', err);
        }
      }
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setState('idle');
    }
  };

  const handleSave = async () => {
    setState('saving');
    try {
      const updated = await slidesApi.update(
        projectSlug,
        slide.sid,
        text,
        title || undefined,
        generatedImage?.url || undefined
      );
      onSave(updated);
    } catch (err) {
      console.error('Failed to save:', err);
      setState('idle');
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
              disabled={state === 'generating' || state === 'saving'}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {state === 'generating' ? '生成中...' : '生成图片'}
            </button>
          </div>

          {/* Generated Image Preview */}
          {generatedImage && (
            <div className="mt-2">
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-bg-light">
                <img src={generatedImage.url} alt="Generated" className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-text-primary/50 mt-1">生成完毕，自动设为展示图</p>
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
            disabled={state === 'saving' || state === 'generating'}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-text-primary font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {state === 'saving' ? '保存中...' : '确认保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
