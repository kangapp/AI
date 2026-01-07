<!--
Sync Impact Report
==================
Version change: (initial) → 1.0.0
Modified principles: N/A (initial creation)
Added sections:
  - Core Principles (5 principles)
  - Technology Stack
  - Development Standards
  - Governance
Removed sections: N/A (initial creation)
Templates requiring updates:
  ✅ plan-template.md - Reviewed, Constitution Check section will use these principles
  ✅ spec-template.md - Reviewed, requirements section compatible with principles
  ✅ tasks-template.md - Reviewed, task structure aligns with principles
Follow-up TODOs: None
-->

# DB Query Constitution

## Core Principles

### I. Ergonomic Python Style

后端代码必须遵循 Ergonomic Python 风格编写。这意味着代码应当简洁、可读性强、充分利用现代 Python 特性。

**Rationale**: Ergonomic Python 强调代码的自然流畅和可维护性，使开发团队能够快速理解和修改代码。

### II. Strict Type Annotations

前后端都必须有严格的类型标注。Python 代码使用类型注解（type hints），TypeScript 代码必须定义所有接口和类型。

**Rationale**: 严格的类型系统能在编译时/开发时捕获错误，提高代码质量和 IDE 支持，减少运行时错误。

### III. Pydantic Data Models

所有后端数据模型必须使用 Pydantic 定义。请求/响应模型、配置模型、领域模型等都应使用 Pydantic BaseModel。

**Rationale**: Pydantic 提供强大的数据验证、序列化和文档生成能力，与 FastAPI 等现代框架无缝集成。

### IV. camelCase JSON Convention

所有后端生成的 JSON 数据必须使用 camelCase 格式。字段名、属性名等应遵循 JavaScript 命名约定。

**Rationale**: 前端 JavaScript/TypeScript 生态系统普遍使用 camelCase，保持一致性减少前后端集成的摩擦。

### V. Open Access Policy

系统不需要身份认证，任何用户都可以使用所有功能。不实现用户管理、权限控制或访问限制。

**Rationale**: 简化系统架构，专注于核心功能。如需在未来添加认证，可作为独立演进。

## Technology Stack

**Backend**:
- Python 3.14+
- Type hints (strict mode)
- Pydantic for data models
- JSON serialization with camelCase

**Frontend**:
- TypeScript
- Strict type checking
- Type-safe API client interfaces

## Development Standards

**Code Style**:
- Python: Follow PEP 8, with Ergonomic Python principles
- TypeScript: Follow ESLint + Prettier configuration
- Maximum line length: 100 characters
- No unused imports or variables

**Type Safety**:
- Python: `mypy --strict` or compatible type checker
- TypeScript: `strict: true` in tsconfig.json
- All function parameters and return types must be annotated
- No `Any` types without explicit justification

**API Contracts**:
- All API endpoints defined with Pydantic models
- Request/response models explicitly typed
- OpenAPI/Swagger documentation auto-generated from models

## Governance

This constitution governs all development activities for the DB Query project. All code changes, feature additions, and architectural decisions must comply with these principles.

**Amendment Procedure**:
1. Propose amendment with rationale
2. Document impact on existing code
3. Update version according to semantic versioning
4. Update dependent templates and documentation
5. Require team consensus before adoption

**Compliance**:
- All pull requests must verify compliance with core principles
- Type checkers must pass without errors
- CI/CD pipelines enforce style and type checks
- Violations must be documented with justification in Complexity Tracking

**Version Policy**:
- MAJOR: Backward incompatible principle removal or redefinition
- MINOR: New principle added or material guidance expansion
- PATCH: Clarifications, wording improvements, non-semantic changes

**Version**: 1.0.0 | **Ratified**: 2026-01-07 | **Last Amended**: 2026-01-07
