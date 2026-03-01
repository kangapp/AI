import type { AppStatus } from '../types';

interface TranscriptDisplayProps {
  status: AppStatus;
  partialText: string;
  committedText: string;
  error: string | null;
}

/**
 * Displays transcription text with status-aware styling
 * - error: red
 * - committed: black
 * - partial: gray
 * - default: hint gray
 */
function TranscriptDisplay({
  status,
  partialText,
  committedText,
  error,
}: TranscriptDisplayProps) {
  // Determine display text and color
  let displayText: string;
  let textColorClass: string;

  if (error) {
    displayText = error;
    textColorClass = 'text-red-500';
  } else if (committedText) {
    displayText = committedText;
    textColorClass = 'text-gray-900';
  } else if (partialText) {
    displayText = partialText;
    textColorClass = 'text-gray-400';
  } else {
    // Default hint based on status
    displayText = status === 'connecting'
      ? 'Connecting...'
      : 'Press Cmd+Shift+H to start recording...';
    textColorClass = 'text-gray-500';
  }

  return (
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium truncate ${textColorClass}`}>
        {displayText}
      </p>
    </div>
  );
}

export default TranscriptDisplay;
