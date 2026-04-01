import { Routes, Route } from 'react-router-dom';
import LauncherPage from './components/LauncherPage';
import ProjectPage from './pages/ProjectPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LauncherPage />} />
      <Route path="/project/:slug" element={<ProjectPage />} />
    </Routes>
  );
}