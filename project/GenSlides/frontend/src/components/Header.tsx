import { useSlidesStore } from '../stores/slidesStore';

interface HeaderProps {
  projectSlug?: string;
}

export default function Header(_props: HeaderProps) {
  const { title, startPlayback, isPlaying } = useSlidesStore();

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-700">
      <div className="flex items-center gap-4">
        <div className="text-xl font-bold text-white">GenSlides</div>
        <div className="text-sm text-gray-400">slides/{title.toLowerCase().replace(/\s+/g, '-')}</div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-500">全屏从当前选中 slide 开始播放</span>
        <button
          onClick={startPlayback}
          disabled={isPlaying}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
        >
          播放
        </button>
      </div>
    </header>
  );
}
