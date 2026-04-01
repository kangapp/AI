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
}

const INITIAL_STATE: CreateState = {
  step: 'form',
  name: '',
  style: ProjectStyle.CUSTOM,
  stylePrompt: '',
  minimaxImage: null,
  geminiImage: null,
  selectedImage: null,
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
        <label className="block text-sm text-gray-400 mb-2">项目名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={50}
          placeholder="最多 50 字符"
          className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
          autoFocus
        />
      </div>

      {/* Style Select */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">风格</label>
        <select
          value={style}
          onChange={(e) => onStyleChange(e.target.value as ProjectStyle)}
          className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
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
        <label className="block text-sm text-gray-400 mb-2">
          {isCustomStyle ? '风格描述' : '补充描述'} <span className="text-gray-600">(可选)</span>
        </label>
        <textarea
          value={stylePrompt}
          onChange={(e) => onStylePromptChange(e.target.value)}
          placeholder={isCustomStyle ? '描述你想要的图片风格...' : '对所选风格的补充说明...'}
          rows={3}
          className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
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
          <div className="w-40 h-40 rounded-lg bg-gray-800 flex items-center justify-center mb-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
          <span className="text-gray-400">MiniMax</span>
        </div>

        {/* Gemini Loading */}
        <div className="flex flex-col items-center">
          <div className="w-40 h-40 rounded-lg bg-gray-800 flex items-center justify-center mb-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          </div>
          <span className="text-gray-400">Gemini</span>
        </div>
      </div>
      <p className="text-gray-400">正在生成风格预览...</p>
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
  isCreating,
}: {
  minimaxImage: string | null;
  geminiImage: string | null;
  selectedImage: 'minimax' | 'gemini' | null;
  onSelectImage: (image: 'minimax' | 'gemini') => void;
  onSkip: () => void;
  onCreateProject: () => void;
  isCreating: boolean;
}) {
  return (
    <div>
      <h3 className="text-lg font-medium text-white mb-4">选择参考图</h3>
      <p className="text-sm text-gray-400 mb-4">点击选择一张图片作为风格参考，或跳过此步骤</p>

      {/* Image Selection */}
      <div className="flex gap-4 mb-6">
        {/* MiniMax Image */}
        <button
          type="button"
          onClick={() => onSelectImage('minimax')}
          className={`relative flex-1 rounded-lg overflow-hidden border-2 transition-colors ${
            selectedImage === 'minimax'
              ? 'border-blue-500 ring-2 ring-blue-500'
              : 'border-gray-700 hover:border-gray-500'
          }`}
        >
          <img
            src={`data:image/png;base64,${minimaxImage}`}
            alt="MiniMax 风格预览"
            className="w-full h-40 object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 text-center text-sm text-white">
            MiniMax
          </div>
        </button>

        {/* Gemini Image */}
        <button
          type="button"
          onClick={() => onSelectImage('gemini')}
          className={`relative flex-1 rounded-lg overflow-hidden border-2 transition-colors ${
            selectedImage === 'gemini'
              ? 'border-purple-500 ring-2 ring-purple-500'
              : 'border-gray-700 hover:border-gray-500'
          }`}
        >
          <img
            src={`data:image/png;base64,${geminiImage}`}
            alt="Gemini 风格预览"
            className="w-full h-40 object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 text-center text-sm text-white">
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
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          不使用参考图
        </button>
        <button
          type="button"
          onClick={onCreateProject}
          disabled={isCreating}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
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
            isCreating={isStoreCreating}
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-white mb-6">{getStepTitle()}</h2>
        {renderStep()}
      </div>
    </div>
  );
}
