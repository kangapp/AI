import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Note: StrictMode is disabled because it causes event listeners to be
// registered twice in development mode, which can lead to missed events
ReactDOM.createRoot(rootElement).render(<App />);
