import { useEffect, useState } from "react";

function App() {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Listen for recording state from backend
    // Will be implemented in Phase 4
    setIsRecording(false);
  }, []);

  return (
    <div className="window-container">
      <div className="status-text">
        {isRecording ? "Recording..." : "Press Cmd+Shift+H to start"}
      </div>
    </div>
  );
}

export default App;
