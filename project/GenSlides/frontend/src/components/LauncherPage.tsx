import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore, Project } from '../stores/projectsStore';
import ProjectCard from './ProjectCard';
import CreateProjectModal from './CreateProjectModal';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function LauncherPage() {
  const navigate = useNavigate();
  const { projects, loading, loadProjects, deleteProject } = useProjectsStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = () => {
    setShowCreateModal(true);
  };

  const handleProjectClick = (slug: string) => {
    navigate(`/project/${slug}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setDeleteTarget(project);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteProject(deleteTarget.slug);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">G</span>
          </div>
          <h1 className="text-2xl font-bold text-white">GenSlides</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-8 py-12">
        {/* Create Button */}
        <div className="mb-10">
          <button
            onClick={handleCreateProject}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建项目
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">还没有项目，点击上方按钮创建一个</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <ProjectCard
                key={project.slug}
                project={project}
                onClick={() => handleProjectClick(project.slug)}
                onDelete={(e) => handleDeleteClick(e, project)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateProjectModal onClose={() => setShowCreateModal(false)} />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}