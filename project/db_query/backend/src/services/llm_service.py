"""LLM service for natural language to SQL generation using zai-sdk."""

from typing import Any

from zai import ZhipuAiClient

from ..core.config import get_config
from ..core.sql_parser import get_parser
from ..models.metadata import ColumnMetadata, TableMetadata, ViewMetadata


class LLMServiceError(Exception):
    """Exception raised when LLM service fails."""

    def __init__(self, message: str, details: str | None = None) -> None:
        """Initialize the error.

        Args:
            message: The error message.
            details: Additional error details.
        """
        self.message = message
        self.details = details
        super().__init__(message)


class LLMService:
    """Service for generating SQL from natural language using zai-sdk."""

    def __init__(self) -> None:
        """Initialize the LLM service."""
        self.config = get_config()
        self.api_key = self.config.zai_api_key
        self._client: ZhipuAiClient | None = None

    def _get_client(self) -> ZhipuAiClient:
        """Get or create the zai-sdk client.

        Returns:
            A zai-sdk ZhipuAiClient.
        """
        if self._client is None:
            self._client = ZhipuAiClient(api_key=self.api_key)
        return self._client

    async def close(self) -> None:
        """Close the client."""
        self._client = None

    def _format_metadata_context(
        self,
        tables: list[TableMetadata],
        views: list[ViewMetadata],
        db_type: str,
    ) -> str:
        """Format database metadata as context for the LLM.

        Args:
            tables: List of table metadata.
            views: List of view metadata.
            db_type: The database type.

        Returns:
            A formatted string describing the database schema.
        """
        lines: list[str] = []

        lines.append(f"Database Type: {db_type}")
        lines.append("")

        # Format tables
        if tables:
            lines.append("Tables:")
            for table in tables[:50]:  # Limit to 50 tables to avoid token limits
                schema_prefix = f"{table.schema}." if table.schema else ""
                lines.append(f"  - {schema_prefix}{table.name}")
                for column in table.columns[:20]:  # Limit columns per table
                    nullable = "NULL" if column.is_nullable else "NOT NULL"
                    pk = "PK" if column.is_primary_key else ""
                    default = f" DEFAULT {column.default_value}" if column.default_value else ""
                    lines.append(
                        f"      {column.name}: {column.data_type} {nullable} {pk}{default}"
                    )
                if table.row_count_estimate:
                    lines.append(f"      (estimated {table.row_count_estimate} rows)")
                lines.append("")

        # Format views
        if views:
            lines.append("Views:")
            for view in views[:20]:  # Limit to 20 views
                schema_prefix = f"{view.schema}." if view.schema else ""
                lines.append(f"  - {schema_prefix}{view.name}")
                for column in view.columns[:20]:
                    nullable = "NULL" if column.is_nullable else "NOT NULL"
                    lines.append(f"      {column.name}: {column.data_type} {nullable}")
                lines.append("")

        return "\n".join(lines)

    async def generate_sql(
        self,
        natural_query: str,
        tables: list[TableMetadata],
        views: list[ViewMetadata],
        db_type: str,
    ) -> tuple[str, str | None]:
        """Generate SQL from a natural language query.

        Args:
            natural_query: The natural language query.
            tables: List of table metadata.
            views: List of view metadata.
            db_type: The database type.

        Returns:
            A tuple of (generated_sql, explanation).

        Raises:
            LLMServiceError: If the LLM service fails.
        """
        # Format metadata as context
        metadata_context = self._format_metadata_context(tables, views, db_type)

        # Build the prompt
        prompt = self._build_prompt(natural_query, metadata_context, db_type)

        # Call the zai-sdk API
        try:
            client = self._get_client()
            response = client.chat.completions.create(
                model="glm-4-flash",
                messages=[
                    {
                        "role": "system",
                        "content": "你是一个 SQL 专家。根据自然语言描述生成 SQL 查询。始终用中文回答，SQL 查询用 ```sql ... ``` 代码块包裹，在 SQL 前包含简短的中文说明。",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=2000,
            )
            content = response.choices[0].message.content
        except Exception as e:
            raise LLMServiceError(
                "Failed to communicate with LLM service",
                details=str(e),
            ) from e

        # Parse the response
        try:
            return self._parse_llm_response(content)
        except Exception as e:
            raise LLMServiceError(
                "Failed to parse LLM response",
                details=str(e),
            ) from e

    def _build_prompt(self, natural_query: str, metadata_context: str, db_type: str) -> str:
        """Build the prompt for the LLM.

        Args:
            natural_query: The natural language query.
            metadata_context: The formatted metadata context.
            db_type: The database type.

        Returns:
            The complete prompt.
        """
        prompt = f"""根据以下自然语言请求生成 SQL 查询:

请求: {natural_query}

可用数据库架构:
{metadata_context}

要求:
1. 只生成 SELECT 查询（不允许 INSERT, UPDATE, DELETE, DROP 等）
2. 使用架构中正确的表名和列名
3. 如果没有指定 LIMIT 子句，在末尾添加 'LIMIT 1000'
4. 为 {db_type} 使用适当的 SQL 语法
5. 返回用 ```sql ... ``` 代码块包裹的 SQL 查询
6. 在 SQL 前包含简短的中文说明

示例格式:
此查询检索所有活跃用户。

```sql
SELECT id, name, email FROM users WHERE is_active = true LIMIT 1000;
```
"""
        return prompt

    def _parse_llm_response(self, content: str) -> tuple[str, str | None]:
        """Parse the LLM response to extract SQL and explanation.

        Args:
            content: The LLM response content.

        Returns:
            A tuple of (sql, explanation).

        Raises:
            LLMServiceError: If the response cannot be parsed.
        """
        # Look for SQL code block
        sql_start = content.find("```sql")
        if sql_start == -1:
            # Try without language specifier
            sql_start = content.find("```")

        if sql_start == -1:
            # No code block found, try to extract SQL directly
            lines = content.split("\n")
            sql_lines = []
            for line in lines:
                line = line.strip()
                if line.upper().startswith(("SELECT", "WITH", "(", "/*")):
                    sql_lines.append(line)
                elif sql_lines:
                    sql_lines.append(line)

            if not sql_lines:
                raise LLMServiceError(
                    "No SQL query found in LLM response",
                    details=content[:200],
                )

            sql = "\n".join(sql_lines).strip()
            return sql, None

        # Extract SQL from code block
        sql_end = content.find("```", sql_start + 6)
        if sql_end == -1:
            sql_end = len(content)

        sql = content[sql_start + 6:sql_end].strip()

        # Extract explanation (text before the code block)
        explanation = content[:sql_start].strip()
        if not explanation:
            explanation = None

        return sql, explanation

    async def validate_and_fix_sql(
        self,
        sql: str,
        tables: list[TableMetadata],
        db_type: str,
    ) -> str:
        """Validate and potentially fix the generated SQL.

        Args:
            sql: The generated SQL.
            tables: List of table metadata.
            db_type: The database type.

        Returns:
            The validated SQL.

        Raises:
            LLMServiceError: If the SQL cannot be validated.
        """
        # Use sqlglot to validate the SQL
        parser = get_parser(db_type)

        try:
            # Check if it's a SELECT query
            parser.validate_select_only(sql)

            # Ensure LIMIT is present
            sql = parser.ensure_limit(sql, default_limit=1000)

            return sql
        except ValueError as e:
            raise LLMServiceError(
                "Generated SQL validation failed",
                details=str(e),
            ) from e

    async def generate_and_validate(
        self,
        natural_query: str,
        tables: list[TableMetadata],
        views: list[ViewMetadata],
        db_type: str,
    ) -> tuple[str, str | None, bool, str | None]:
        """Generate SQL from natural language and validate it.

        Args:
            natural_query: The natural language query.
            tables: List of table metadata.
            views: List of view metadata.
            db_type: The database type.

        Returns:
            A tuple of (sql, explanation, is_valid, validation_message).
        """
        try:
            # Generate SQL
            sql, explanation = await self.generate_sql(
                natural_query, tables, views, db_type
            )

            # Validate SQL
            validated_sql = await self.validate_and_fix_sql(sql, tables, db_type)

            return validated_sql, explanation, True, None

        except LLMServiceError as e:
            return "", None, False, f"{e.message}: {e.details}" if e.details else e.message

    async def generate_suggested_queries(
        self,
        tables: list[TableMetadata],
        views: list[ViewMetadata],
        db_type: str,
        limit: int = 6,
        seed: int | None = None,
        exclude: list[str] | None = None,
        history: list[str] | None = None,
    ) -> list[str]:
        """Generate suggested query descriptions based on database metadata.

        Args:
            tables: List of table metadata.
            views: List of view metadata.
            db_type: The database type.
            limit: Number of suggestions to generate.
            seed: Random seed for generating different suggestions.
            exclude: List of suggestions to exclude from the response.
            history: List of historical query descriptions for context.

        Returns:
            A list of suggested query descriptions in Chinese.

        Raises:
            LLMServiceError: If the LLM service fails.
        """
        # Format metadata as context
        metadata_context = self._format_metadata_context(tables, views, db_type)

        # Build the prompt for suggestions
        prompt = f"""基于以下数据库架构，生成 {limit} 个实用的查询建议。

数据库架构:
{metadata_context}
"""

        # Add history context if available
        if history:
            prompt += f"\n用户历史查询（用于参考偏好）:\n"
            for i, h in enumerate(history[:5], 1):
                prompt += f"  {i}. {h}\n"

        prompt += f"""
要求:
1. 生成 {limit} 个不同类型的查询建议
2. 每个建议用中文描述
3. 建议应该涵盖常见的查询场景，如: 数据统计、关联查询、排序筛选等
4. 每个建议应该简洁明了，不超过20个字
5. 只返回建议列表，每行一个，不要有编号或其他格式
"""

        # Add exclusion context
        if exclude:
            prompt += f"\n请避免生成以下已展示的建议: {', '.join(exclude[:10])}\n"

        prompt += """
示例格式:
显示所有订单按日期排序
统计每个客户的订单数量
查找价格最高的前10个商品
"""

        try:
            client = self._get_client()
            # Use seed to influence randomness via different system prompts
            system_content = "你是一个数据库查询专家，擅长根据数据库结构生成实用的中文查询建议。"
            if seed is not None:
                system_content += f" 今天的随机种子是 {seed}，请生成不同于以往的建议。"

            response = client.chat.completions.create(
                model="glm-4-flash",
                messages=[
                    {
                        "role": "system",
                        "content": system_content,
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.9 if seed is not None else 0.8,  # Higher temperature for refresh
                max_tokens=500,
                top_p=0.95,
            )
            content = response.choices[0].message.content

            # Parse the response into a list of suggestions
            suggestions = [
                line.strip()
                for line in content.strip().split("\n")
                if line.strip() and not line.strip().startswith(("```", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.", "10.", "-", "*", "#"))
            ]

            # Clean up common prefixes
            cleaned_suggestions = []
            for suggestion in suggestions:
                # Remove common prefixes like "查询:", "显示:", "统计:" etc.
                cleaned = suggestion
                for prefix in ["查询：", "显示：", "统计：", "查找：", "查询:", "显示:", "统计:", "查找:"]:
                    if cleaned.startswith(prefix):
                        cleaned = cleaned[len(prefix):]
                        break
                # Check if suggestion should be excluded
                if cleaned and (not exclude or cleaned not in exclude):
                    cleaned_suggestions.append(cleaned)

            return cleaned_suggestions[:limit]

        except Exception as e:
            raise LLMServiceError(
                "Failed to generate suggested queries",
                details=str(e),
            ) from e
