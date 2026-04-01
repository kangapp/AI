import re
import yaml
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List
from pypinyin import lazy_pinyin
from models import Project, ProjectCreate, ProjectStyle


def slugify(name: str) -> str:
    """将项目名称转换为 URL-safe slug"""
    # 先将中文转换为拼音
    slug = ' '.join(lazy_pinyin(name))
    # 转换为小写，替换空格为连字符
    slug = slug.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug[:50]  # 限制长度


class ProjectsManager:
    BASE_DIR = Path("projects")

    def __init__(self, base_path: Optional[Path] = None):
        self.base_dir = base_path or self.BASE_DIR
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_project_dir(self, slug: str) -> Path:
        return self.base_dir / slug

    def _get_project_yml_path(self, slug: str) -> Path:
        return self._get_project_dir(slug) / "project.yml"

    def _load_project(self, slug: str) -> Optional[Project]:
        path = self._get_project_yml_path(slug)
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            return Project(**data)

    def _save_project(self, project: Project) -> None:
        path = self._get_project_yml_path(project.slug)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(project.model_dump(mode="json"), f, allow_unicode=True, sort_keys=False)

    def _generate_unique_slug(self, base_slug: str) -> str:
        """如果 slug 已存在，添加数字后缀"""
        slug = base_slug
        counter = 2
        while self._get_project_dir(slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug

    def list_projects(self) -> List[Project]:
        """列出所有项目"""
        projects = []
        if not self.base_dir.exists():
            return projects
        for proj_dir in self.base_dir.iterdir():
            if proj_dir.is_dir():
                project = self._load_project(proj_dir.name)
                if project:
                    projects.append(project)
        return sorted(projects, key=lambda p: p.created_at, reverse=True)

    def create_project(self, data: ProjectCreate) -> Project:
        """创建新项目"""
        base_slug = slugify(data.name)
        slug = self._generate_unique_slug(base_slug)

        project = Project(
            slug=slug,
            name=data.name,
            style=data.style,
            style_prompt=data.style_prompt,
            created_at=datetime.now(timezone.utc)
        )

        # 创建目录结构
        project_dir = self._get_project_dir(slug)
        (project_dir / "slides").mkdir(parents=True, exist_ok=True)
        (project_dir / "slides" / "images").mkdir(parents=True, exist_ok=True)

        # 创建空的 outline.yml
        outline_path = project_dir / "slides" / "outline.yml"
        with open(outline_path, "w", encoding="utf-8") as f:
            yaml.dump({"title": data.name, "slides": []}, f, allow_unicode=True, sort_keys=False)

        self._save_project(project)
        return project

    def get_project(self, slug: str) -> Optional[Project]:
        """获取项目详情"""
        return self._load_project(slug)

    def delete_project(self, slug: str) -> bool:
        """删除项目及其所有内容"""
        project_dir = self._get_project_dir(slug)
        if not project_dir.exists():
            return False
        shutil.rmtree(project_dir)
        return True

    def ensure_default_project(self) -> Project:
        """确保 default 项目存在（用于向后兼容）"""
        # 先检查旧数据是否存在
        old_slides_dir = Path("slides")
        old_images_dir = Path("slides/images")
        has_old_data = old_slides_dir.exists() and (old_slides_dir / "outline.yml").exists()

        # 检查 default 项目是否已存在
        default_project = self._load_project("default")
        if default_project:
            return default_project

        # 创建 default 项目
        default_project = Project(
            slug="default",
            name="默认项目",
            style=ProjectStyle.PHOTOREALISTIC,
            style_prompt="",
            created_at=datetime.now(timezone.utc)
        )
        self._save_project(default_project)

        # 迁移旧数据（如果存在）
        if has_old_data:
            default_slides_dir = self.base_dir / "default" / "slides"
            default_slides_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy(old_slides_dir / "outline.yml", default_slides_dir / "outline.yml")
            # 迁移 images
            if old_images_dir.exists():
                default_images_dir = default_slides_dir / "images"
                default_images_dir.mkdir(parents=True, exist_ok=True)
                for item in old_images_dir.iterdir():
                    if item.is_dir():
                        shutil.copytree(item, default_images_dir / item.name, dirs_exist_ok=True)
                    else:
                        shutil.copy(item, default_images_dir / item.name)

        return default_project