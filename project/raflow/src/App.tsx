import { useEffect } from "react";
import { useTranscription } from "./hooks/useTranscription";
import { TranscriptDisplay } from "./components/TranscriptDisplay";
import { WaveformVisualizer } from "./components/WaveformVisualizer";
import { getCurrentWindow } from "@tauri-apps/api/window";

function App() {
  const { status, partialText, committedText, audioLevel } = useTranscription();
  const isRecording = status === "recording";

  useEffect(() => {
    const win = getCurrentWindow();

    // Show window when recording starts
    if (isRecording) {
      win.show();
      win.setFocus();
    }
  }, [isRecording]);

  return (
    <div className="window-container">
      <WaveformVisualizer level={audioLevel} isRecording={isRecording} />
      <TranscriptDisplay partial={partialText} committed={committedText} />
      {!isRecording && !committedText && !partialText && (
        <p className="text-gray-500 text-xs mt-2">
          Press ⌘⇧H to start
        </p>
      )}
    </div>
  );
}

export default App;
