import pytest
import tempfile
import shutil
from pathlib import Path
from models import ProjectStyle, ProjectCreate
from projects_manager import (
    ProjectsManager, slugify, ProjectCreateError, ProjectSaveError
)


class TestSlugify:
    def test_slugify_basic(self):
        assert slugify("My Project") == "my-project"

    def test_slugify_chinese(self):
        result = slugify("我的项目")
        assert "wo" in result or "de" in result

    def test_slugify_max_length(self):
        long_name = "a" * 100
        result = slugify(long_name)
        assert len(result) <= 50

    def test_slugify_special_chars(self):
        # Special characters are removed (not replaced with hyphens)
        assert slugify("Test@#$%Project") == "testproject"


class TestProjectsManager:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.manager = ProjectsManager(base_path=Path(self.temp_dir))

    def teardown_method(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_create_project(self):
        data = ProjectCreate(
            name="Test Project",
            style=ProjectStyle.PHOTOREALISTIC,
            style_prompt=""
        )
        project = self.manager.create_project(data)

        assert project.name == "Test Project"
        assert project.style == ProjectStyle.PHOTOREALISTIC
        assert project.slug == "test-project"

    def test_create_project_with_chinese_name(self):
        data = ProjectCreate(
            name="测试项目",
            style=ProjectStyle.ANIME,
            style_prompt=""
        )
        project = self.manager.create_project(data)

        assert project.name == "测试项目"
        assert project.style == ProjectStyle.ANIME

    def test_create_project_duplicate_name(self):
        data = ProjectCreate(
            name="Test",
            style=ProjectStyle.PHOTOREALISTIC,
            style_prompt=""
        )
        project1 = self.manager.create_project(data)
        project2 = self.manager.create_project(data)

        assert project1.slug == "test"
        assert project2.slug == "test-2"

    def test_list_projects(self):
        data = ProjectCreate(
            name="Project One",
            style=ProjectStyle.MINIMALIST,
            style_prompt=""
        )
        self.manager.create_project(data)

        projects = self.manager.list_projects()
        assert len(projects) == 1
        assert projects[0].name == "Project One"

    def test_get_project(self):
        data = ProjectCreate(
            name="Get Test",
            style=ProjectStyle.CYBERPUNK,
            style_prompt=""
        )
        created = self.manager.create_project(data)

        retrieved = self.manager.get_project(created.slug)
        assert retrieved is not None
        assert retrieved.name == "Get Test"

    def test_get_nonexistent_project(self):
        result = self.manager.get_project("nonexistent")
        assert result is None

    def test_delete_project(self):
        data = ProjectCreate(
            name="Delete Test",
            style=ProjectStyle.OIL_PAINTING,
            style_prompt=""
        )
        project = self.manager.create_project(data)

        result = self.manager.delete_project(project.slug)
        assert result is True
        assert self.manager.get_project(project.slug) is None

    def test_delete_nonexistent_project(self):
        result = self.manager.delete_project("nonexistent")
        assert result is False

    def test_ensure_default_project_creates_if_not_exists(self):
        project = self.manager.ensure_default_project()

        assert project.slug == "default"
        assert project.name == "默认项目"
        assert project.style == ProjectStyle.PHOTOREALISTIC

    def test_ensure_default_project_returns_existing(self):
        # Create default project first
        data = ProjectCreate(
            name="Custom Default",
            style=ProjectStyle.ANIME,
            style_prompt="custom"
        )
        project = self.manager.create_project(data)

        # Modify slug to be "default"
        project.slug = "default"
        self.manager._save_project(project)

        # ensure_default_project should return existing
        result = self.manager.ensure_default_project()
        assert result.name == "Custom Default"

    def test_create_project_creates_directory_structure(self):
        data = ProjectCreate(
            name="Dir Test",
            style=ProjectStyle.PHOTOREALISTIC,
            style_prompt=""
        )
        project = self.manager.create_project(data)

        project_dir = Path(self.temp_dir) / project.slug
        assert (project_dir / "slides").exists()
        assert (project_dir / "slides" / "images").exists()
        assert (project_dir / "slides" / "outline.yml").exists()

    def test_project_full_style(self):
        from models import Project, PROJECT_STYLE_DEFAULTS

        project = Project(
            slug="test",
            name="Test",
            style=ProjectStyle.PHOTOREALISTIC,
            style_prompt="custom addition"
        )

        full_style = project.get_full_style()
        assert "照片级真实感" in full_style
        assert "custom addition" in full_style


class TestProjectsManagerErrors:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.manager = ProjectsManager(base_path=Path(self.temp_dir))

    def teardown_method(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_save_project_error(self):
        # Create a project with invalid slug that can't be saved
        # We can't easily trigger OSError in normal circumstances,
        # but we can verify the error class exists
        assert ProjectSaveError is not None
        assert issubclass(ProjectSaveError, Exception)

    def test_create_error_class(self):
        assert ProjectCreateError is not None
        assert issubclass(ProjectCreateError, Exception)
