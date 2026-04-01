import { Project } from '../stores/projectsStore';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const STYLE_LABELS: Record<string, string> = {
  photorealistic: '写实摄影',
  anime: '动漫/二次元',
  'ink-wash': '水墨/国风',
  cyberpunk: '赛博朋克',
  minimalist: '极简主义',
  'oil-painting': '油画/艺术',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ProjectCard({ project, onClick, onDelete }: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-900 rounded-xl overflow-hidden cursor-pointer hover:bg-gray-800 transition-colors group"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-800 relative">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-600 text-4xl">📷</span>
          </div>
        )}

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-white font-medium truncate">{project.name}</h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {project.slide_count || 0} slides
          </span>
          <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">
            {STYLE_LABELS[project.style] || project.style}
          </span>
        </div>
        <div className="mt-1">
          <span className="text-xs text-gray-600">
            创建于 {formatDate(project.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}