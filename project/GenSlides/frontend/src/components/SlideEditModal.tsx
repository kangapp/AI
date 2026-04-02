import { useState } from 'react';
import type { Slide } from '../types';
import { slidesApi } from '../api';

interface SlideEditModalProps {
  slide: Slide;
  projectSlug: string;
  onClose: () => void;
  onSave: (updatedSlide: Slide) => void;
}

type ModalState = 'idle' | 'extracting' | 'generating' | 'selecting' | 'saving';

export default function SlideEditModal({ slide, projectSlug, onClose, onSave }: SlideEditModalProps) {
  const [text, setText] = useState(slide.text);
  const [title, setTitle] = useState(slide.title || '');
  const [provider, setProvider] = useState<'minimax' | 'gemini'>('minimax');
  const [state, setState] = useState<ModalState>('idle');
  const [generatedImages, setGeneratedImages] = useState<{ hash: string; url: string }[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(slide.thumbnail || null);

  const handleExtractTitle = async () => {
    setState('extracting');
    try {
      const result = await slidesApi.extractTitle(projectSlug, slide.sid, text);
      setTitle(result.title);
    } catch (err) {
      console.error('Failed to extract title:', err);
    } finally {
      setState('idle');
    }
  };

  const handleGenerateImages = async () => {
    setState('generating');
    try {
      const results = await slidesApi.generateMultipleImages(projectSlug, slide.sid, provider, 2);
      setGeneratedImages(results.map(r => ({ hash: r.hash, url: r.image_url })));
      setState('selecting');
    } catch (err) {
      console.error('Failed to generate images:', err);
      setState('idle');
    }
  };

  const handleSave = async () => {
    setState('saving');
    try {
      const updated = await slidesApi.update(projectSlug, slide.sid, text, title || undefined, selectedImage || undefined);
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

          {/* Extract Title */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExtractTitle}
              disabled={state === 'extracting'}
              className="px-4 py-2 bg-bg-light hover:bg-primary/20 text-text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {state === 'extracting' ? '提取中...' : '提取标题'}
            </button>
            {title && <span className="text-sm text-text-primary/70">{title}</span>}
          </div>

          <hr className="border-text-primary/10" />

          {/* Image Generation */}
          <div>
            <label className="block text-sm font-medium text-text-primary/70 mb-2">图片生成</label>
            <button
              onClick={handleGenerateImages}
              disabled={state === 'generating' || state === 'saving'}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {state === 'generating' ? '生成中...' : '生成 2 张图片'}
            </button>
          </div>

          {/* Image Selection */}
          {(state === 'selecting' || generatedImages.length > 0) && (
            <div className="flex gap-3">
              {generatedImages.map((img, idx) => (
                <div
                  key={img.hash}
                  onClick={() => setSelectedImage(img.url)}
                  className={`relative w-32 h-32 rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${
                    selectedImage === img.url ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img src={img.url} alt={`Generated ${idx + 1}`} className="w-full h-full object-cover" />
                  {selectedImage === img.url && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-xs text-text-primary">✓</span>
                    </div>
                  )}
                </div>
              ))}
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
