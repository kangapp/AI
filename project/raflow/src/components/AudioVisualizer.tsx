import { WaveformVisualizer } from "./WaveformVisualizer";
import { PulseVisualizer } from "./visualizers/PulseVisualizer";
import { SpectrumVisualizer } from "./visualizers/SpectrumVisualizer";
import { ParticleVisualizer } from "./visualizers/ParticleVisualizer";
import { RecordingStatus } from "../hooks/useTranscription";

interface AudioVisualizerProps {
  level: number;
  status: RecordingStatus;
  style: "waveform" | "pulse" | "spectrum" | "particle";
  compact?: boolean;
}

export function AudioVisualizer({ level, status, style, compact = false }: AudioVisualizerProps) {
  return (
    <div className="w-full h-full overflow-hidden">
      {style === "pulse" && <PulseVisualizer level={level} status={status} compact={compact} />}
      {style === "spectrum" && <SpectrumVisualizer level={level} status={status} compact={compact} />}
      {style === "particle" && <ParticleVisualizer level={level} status={status} compact={compact} />}
      {(style === "waveform" || !style) && <WaveformVisualizer level={level} status={status} compact={compact} />}
    </div>
  );
}
