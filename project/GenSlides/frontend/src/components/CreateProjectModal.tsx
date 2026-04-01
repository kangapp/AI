import { useState } from 'react';
import { useProjectsStore, ProjectStyle } from '../stores/projectsStore';
import { useNavigate } from 'react-router-dom';

interface CreateProjectModalProps {
  onClose: () => void;
}

const STYLE_OPTIONS = [
  { value: ProjectStyle.PHOTOREALISTIC, label: '写实摄影', desc: '照片级真实感' },
  { value: ProjectStyle.ANIME, label: '动漫/二次元', desc: '日系动漫画风' },
  { value: ProjectStyle.INK_WASH, label: '水墨/国风', desc: '中国传统水墨画风格' },
  { value: ProjectStyle.CYBERPUNK, label: '赛博朋克', desc: '未来科技感' },
  { value: ProjectStyle.MINIMALIST, label: '极简主义', desc: '简洁留白设计' },
  { value: ProjectStyle.OIL_PAINTING, label: '油画/艺术', desc: '艺术绘画质感' },
];

export default function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const { createProject, isCreating } = useProjectsStore();
  const [name, setName] = useState('');
  const [style, setStyle] = useState<ProjectStyle>(ProjectStyle.PHOTOREALISTIC);
  const [stylePrompt, setStylePrompt] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isCreating) return;

    const project = await createProject({ name: name.trim(), style, style_prompt: stylePrompt.trim() });
    onClose();
    if (project) {
      navigate(`/project/${project.slug}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-white mb-6">创建项目</h2>

        <form onSubmit={handleSubmit}>
          {/* Project Name */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">项目名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              onChange={(e) => setStyle(e.target.value as ProjectStyle)}
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
              自定义描述 <span className="text-gray-600">(可选)</span>
            </label>
            <textarea
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              placeholder="对所选风格的补充说明..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
            >
              {isCreating ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}