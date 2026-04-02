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
    <header className="h-16 px-6 flex items-center justify-between border-b border-text-primary/10 bg-white">
      {/* Left: Back button + Project name */}
      <div className="flex items-center gap-4">
        {projectSlug && (
          <button
            onClick={handleBack}
            className="p-2 hover:bg-primary/20 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h2 className="text-text-primary font-medium truncate max-w-md">
          {projectName || 'GenSlides'}
        </h2>
      </div>

      {/* Right: Play button */}
      <button
        onClick={handlePlay}
        disabled={isPlaying}
        className="btn-primary text-sm flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        </svg>
        播放
      </button>
    </header>
  );
}
