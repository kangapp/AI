import { useState } from 'react';
import { useProjectsStore, ProjectStyle } from '../stores/projectsStore';
import { useNavigate } from 'react-router-dom';

interface CreateProjectModalProps {
  onClose: () => void;
}

// Step types
type CreateStep = 'form' | 'previewing' | 'selecting';

interface CreateState {
  step: CreateStep;
  name: string;
  style: ProjectStyle;
  stylePrompt: string;
  minimaxImage: string | null;
  geminiImage: string | null;
  selectedImage: 'minimax' | 'gemini' | null;
  isRefreshing: boolean;
}

const INITIAL_STATE: CreateState = {
  step: 'form',
  name: '',
  style: ProjectStyle.CUSTOM,
  stylePrompt: '',
  minimaxImage: null,
  geminiImage: null,
  selectedImage: null,
  isRefreshing: false,
};

const STYLE_OPTIONS = [
  { value: ProjectStyle.CUSTOM, label: '自定义', desc: '完全自定义风格描述' },
  { value: ProjectStyle.PHOTOREALISTIC, label: '写实摄影', desc: '照片级真实感' },
  { value: ProjectStyle.ANIME, label: '动漫/二次元', desc: '日系动漫画风' },
  { value: ProjectStyle.INK_WASH, label: '水墨/国风', desc: '中国传统水墨画风格' },
  { value: ProjectStyle.CYBERPUNK, label: '赛博朋克', desc: '未来科技感' },
  { value: ProjectStyle.MINIMALIST, label: '极简主义', desc: '简洁留白设计' },
  { value: ProjectStyle.OIL_PAINTING, label: '油画/艺术', desc: '艺术绘画质感' },
];

// Step 1: Form Component
function FormStep({
  name,
  style,
  stylePrompt,
  isCustomStyle,
  onNameChange,
  onStyleChange,
  onStylePromptChange,
  onGeneratePreview,
  onCancel,
}: {
  name: string;
  style: ProjectStyle;
  stylePrompt: string;
  isCustomStyle: boolean;
  onNameChange: (name: string) => void;
  onStyleChange: (style: ProjectStyle) => void;
  onStylePromptChange: (prompt: string) => void;
  onGeneratePreview: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGeneratePreview();
      }}
    >
      {/* Project Name */}
      <div className="mb-4">
        <label className="block text-sm text-text-primary/70 mb-2">项目名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={50}
          placeholder="最多 50 字符"
          className="w-full px-4 py-2 bg-bg-light text-text-primary rounded-lg border border-text-primary/20 focus:border-primary focus:outline-none"
          autoFocus
        />
      </div>

      {/* Style Select */}
      <div className="mb-4">
        <label className="block text-sm text-text-primary/70 mb-2">风格</label>
        <select
          value={style}
          onChange={(e) => onStyleChange(e.target.value as ProjectStyle)}
          className="w-full px-4 py-2 bg-bg-light text-text-primary rounded-lg border border-text-primary/20 focus:border-primary focus:outline-none"
        >
          {STYLE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label} - {opt.desc}
            </option>
          ))}
        </select>
      </div>

      {/* Style Prompt */}
      <div className="mb-6">
        <label className="block text-sm text-text-primary/70 mb-2">
          {isCustomStyle ? '风格描述' : '补充描述'} <span className="text-text-primary/40">(可选)</span>
        </label>
        <textarea
          value={stylePrompt}
          onChange={(e) => onStylePromptChange(e.target.value)}
          placeholder={isCustomStyle ? '描述你想要的图片风格...' : '对所选风格的补充说明...'}
          rows={3}
          className="w-full px-4 py-2 bg-bg-light text-text-primary rounded-lg border border-text-primary/20 focus:border-primary focus:outline-none resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
        >
          生成风格预览
        </button>
      </div>
    </form>
  );
}

// Step 2: Previewing Component
function PreviewingStep() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="flex gap-8 mb-8">
        {/* MiniMax Loading */}
        <div className="flex flex-col items-center">
          <div className="w-40 h-40 rounded-lg bg-bg-light border border-text-primary/10 flex items-center justify-center mb-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          </div>
          <span className="text-text-primary/70">MiniMax</span>
        </div>

        {/* Gemini Loading */}
        <div className="flex flex-col items-center">
          <div className="w-40 h-40 rounded-lg bg-bg-light border border-text-primary/10 flex items-center justify-center mb-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          </div>
          <span className="text-text-primary/70">Gemini</span>
        </div>
      </div>
      <p className="text-text-primary/70">正在生成风格预览...</p>
    </div>
  );
}

// Step 3: Selecting Component
function SelectingStep({
  minimaxImage,
  geminiImage,
  selectedImage,
  onSelectImage,
  onSkip,
  onCreateProject,
  onRefresh,
  isCreating,
  isRefreshing,
}: {
  minimaxImage: string | null;
  geminiImage: string | null;
  selectedImage: 'minimax' | 'gemini' | null;
  onSelectImage: (image: 'minimax' | 'gemini') => void;
  onSkip: () => void;
  onCreateProject: () => void;
  onRefresh: () => void;
  isCreating: boolean;
  isRefreshing: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-medium text-text-primary">选择参考图</h3>
          <p className="text-sm text-text-primary/60">点击选择一张图片作为风格参考，或跳过此步骤</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="px-3 py-1.5 text-sm text-text-primary hover:text-text-primary/80 border border-text-primary/20 hover:border-text-primary/40 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isRefreshing ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* Image Selection */}
      <div className="flex gap-4 mb-6">
        {/* MiniMax Image */}
        <button
          type="button"
          onClick={() => onSelectImage('minimax')}
          disabled={!minimaxImage}
          className={`relative flex-1 rounded-lg overflow-hidden border-2 transition-colors ${
            selectedImage === 'minimax'
              ? 'border-primary ring-2 ring-primary'
              : 'border-text-primary/20 hover:border-primary'
          } ${!minimaxImage ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {minimaxImage ? (
            <img
              src={minimaxImage}
              alt="MiniMax 风格预览"
              className="w-full h-40 object-cover"
            />
          ) : (
            <div className="w-full h-40 bg-bg-light flex items-center justify-center border border-text-primary/10">
              <span className="text-text-primary/40 text-sm">生成失败</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-text-primary/60 py-1 text-center text-sm text-white">
            MiniMax
          </div>
        </button>

        {/* Gemini Image */}
        <button
          type="button"
          onClick={() => onSelectImage('gemini')}
          disabled={!geminiImage}
          className={`relative flex-1 rounded-lg overflow-hidden border-2 transition-colors ${
            selectedImage === 'gemini'
              ? 'border-primary ring-2 ring-primary'
              : 'border-text-primary/20 hover:border-primary'
          } ${!geminiImage ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {geminiImage ? (
            <img
              src={geminiImage}
              alt="Gemini 风格预览"
              className="w-full h-40 object-cover"
            />
          ) : (
            <div className="w-full h-40 bg-bg-light flex items-center justify-center border border-text-primary/10">
              <span className="text-text-primary/40 text-sm">生成失败</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-text-primary/60 py-1 text-center text-sm text-white">
            Gemini
          </div>
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onSkip}
          disabled={isCreating}
          className="px-4 py-2 text-text-primary/60 hover:text-text-primary transition-colors disabled:opacity-50"
        >
          不使用参考图
        </button>
        <button
          type="button"
          onClick={onCreateProject}
          disabled={isCreating}
          className="btn-primary"
        >
          {isCreating ? '创建中...' : '创建项目'}
        </button>
      </div>
    </div>
  );
}

export default function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const { createProject, isCreating: isStoreCreating } = useProjectsStore();
  const [state, setState] = useState<CreateState>(INITIAL_STATE);

  const isCustomStyle = state.style === ProjectStyle.CUSTOM;

  const handleNameChange = (name: string) => {
    setState(prev => ({ ...prev, name }));
  };

  const handleStyleChange = (style: ProjectStyle) => {
    setState(prev => ({ ...prev, style }));
  };

  const handleStylePromptChange = (stylePrompt: string) => {
    setState(prev => ({ ...prev, stylePrompt }));
  };

  const handleSelectImage = (image: 'minimax' | 'gemini') => {
    setState(prev => ({ ...prev, selectedImage: image }));
  };

  // Refresh preview images
  const handleRefresh = async () => {
    setState(prev => ({ ...prev, isRefreshing: true, selectedImage: null }));

    try {
      const response = await fetch('/api/projects/preview-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style_prompt: state.stylePrompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate preview');
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        minimaxImage: data.minimax_image,
        geminiImage: data.gemini_image,
        isRefreshing: false,
      }));
    } catch (error) {
      console.error('Preview refresh failed:', error);
      setState(prev => ({ ...prev, isRefreshing: false }));
    }
  };

  // Generate preview images
  const handleGeneratePreview = async () => {
    if (!state.name.trim()) return;

    setState(prev => ({ ...prev, step: 'previewing' }));

    try {
      const response = await fetch('/api/projects/preview-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style_prompt: state.stylePrompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate preview');
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        step: 'selecting',
        minimaxImage: data.minimax_image,
        geminiImage: data.gemini_image,
      }));
    } catch (error) {
      console.error('Preview generation failed:', error);
      // Go back to form on error
      setState(prev => ({ ...prev, step: 'form' }));
    }
  };

  // Skip image selection and create project
  const handleSkip = async () => {
    await handleCreateProject();
  };

  // Create project with selected image
  const handleCreateProject = async () => {
    const styleReferenceImage =
      state.selectedImage === 'minimax'
        ? state.minimaxImage ?? undefined
        : state.selectedImage === 'gemini'
        ? state.geminiImage ?? undefined
        : undefined;

    const project = await createProject({
      name: state.name.trim(),
      style: state.style,
      style_prompt: state.stylePrompt.trim(),
      style_reference_image: styleReferenceImage,
    });

    onClose();
    if (project) {
      navigate(`/project/${project.slug}`);
    }
  };

  const renderStep = () => {
    switch (state.step) {
      case 'form':
        return (
          <FormStep
            name={state.name}
            style={state.style}
            stylePrompt={state.stylePrompt}
            isCustomStyle={isCustomStyle}
            onNameChange={handleNameChange}
            onStyleChange={handleStyleChange}
            onStylePromptChange={handleStylePromptChange}
            onGeneratePreview={handleGeneratePreview}
            onCancel={onClose}
          />
        );
      case 'previewing':
        return <PreviewingStep />;
      case 'selecting':
        return (
          <SelectingStep
            minimaxImage={state.minimaxImage}
            geminiImage={state.geminiImage}
            selectedImage={state.selectedImage}
            onSelectImage={handleSelectImage}
            onSkip={handleSkip}
            onCreateProject={handleCreateProject}
            onRefresh={handleRefresh}
            isCreating={isStoreCreating}
            isRefreshing={state.isRefreshing}
          />
        );
    }
  };

  const getStepTitle = () => {
    switch (state.step) {
      case 'form':
        return '创建项目';
      case 'previewing':
        return '生成预览';
      case 'selecting':
        return '选择风格';
    }
  };

  return (
    <div className="fixed inset-0 bg-text-primary/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-hard">
        <h2 className="text-xl font-semibold text-text-primary mb-6">{getStepTitle()}</h2>
        {renderStep()}
      </div>
    </div>
  );
}
