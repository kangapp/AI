import { Project } from '../stores/projectsStore';

interface DeleteConfirmModalProps {
  project: Project;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({ project, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-white mb-4">确认删除</h2>

        <p className="text-gray-300 mb-2">
          确定要删除项目 <span className="text-white font-medium">"{project.name}"</span> 吗？
        </p>

        <p className="text-gray-500 text-sm mb-4">
          此操作将删除该项目下的所有内容：
        </p>

        <ul className="text-gray-400 text-sm mb-6 space-y-1">
          <li>- {project.slide_count || 0} 个 slides</li>
          <li>- 若干张已生成的图片</li>
        </ul>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}