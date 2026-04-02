import { useNavigate } from 'react-router-dom';
import { useSlidesStore } from '../stores/slidesStore';
import { useProjectsStore } from '../stores/projectsStore';

interface HeaderProps {
  projectSlug?: string;
}

export default function Header({ projectSlug }: HeaderProps) {
  const navigate = useNavigate();
  const { projects } = useProjectsStore();
  const { startPlayback, isPlaying } = useSlidesStore();

  const project = projects.find(p => p.slug === projectSlug);
  const projectName = project?.name || projectSlug;

  const handleBack = () => {
    navigate('/');
  };

  const handlePlay = () => {
    startPlayback();
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-30 h-16 px-4 flex items-center justify-between">
      {/* Left: Back button + Project name */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg">
        {projectSlug && (
          <button
            onClick={handleBack}
            className="p-1.5 hover:bg-primary/20 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h2 className="text-text-primary text-sm font-medium truncate max-w-xs">
          {projectName || 'GenSlides'}
        </h2>
      </div>

      {/* Right: Play button */}
      <button
        onClick={handlePlay}
        disabled={isPlaying}
        className="px-4 py-2 bg-primary hover:bg-primary/90 text-text-primary text-sm font-medium rounded-lg shadow-lg transition-all hover:scale-105 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        </svg>
        播放
      </button>
    </header>
  );
}
