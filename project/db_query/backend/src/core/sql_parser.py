"""SQL parser and validator using sqlglot."""

from typing import cast

import sqlglot
from sqlglot import exp
from sqlglot.dialects import Dialect


class SQLParseError(Exception):
    """Exception raised when SQL parsing fails."""

    def __init__(self, message: str, sql: str) -> None:
        """Initialize the exception.

        Args:
            message: The error message.
            sql: The SQL that failed to parse.
        """
        self.message = message
        self.sql = sql
        super().__init__(f"{message}\nSQL: {sql}")


class SQLValidationError(Exception):
    """Exception raised when SQL validation fails."""

    def __init__(self, message: str, sql: str | None = None) -> None:
        """Initialize the exception.

        Args:
            message: The error message.
            sql: The SQL that failed validation.
        """
        self.message = message
        self.sql = sql
        super().__init__(message)


class SQLParser:
    """SQL parser and validator using sqlglot."""

    def __init__(self, dialect: str = "postgres") -> None:
        """Initialize the SQL parser.

        Args:
            dialect: The SQL dialect to use (mysql, postgres, sqlite).
        """
        self.dialect = self._get_dialect(dialect)

    def _get_dialect(self, name: str) -> Dialect:
        """Get the sqlglot dialect by name.

        Args:
            name: The dialect name.

        Returns:
            The sqlglot Dialect instance.
        """
        dialect_map = {
            "mysql": sqlglot.dialects.MySQL,
            "postgresql": sqlglot.dialects.Postgres,
            "postgres": sqlglot.dialects.Postgres,
            "sqlite": sqlglot.dialects.SQLite,
        }
        if name.lower() not in dialect_map:
            raise SQLValidationError(f"Unsupported dialect: {name}")
        return dialect_map[name.lower()]()

    def parse(self, sql: str) -> exp.Expression:
        """Parse a SQL string into an AST.

        Args:
            sql: The SQL string to parse.

        Returns:
            The parsed SQL expression.

        Raises:
            SQLParseError: If the SQL cannot be parsed.
        """
        try:
            return sqlglot.parse_one(sql, dialect=self.dialect)
        except sqlglot.ParseError as e:
            raise SQLParseError(f"SQL syntax error: {e}", sql) from e

    def validate_select_only(self, sql: str) -> None:
        """Validate that the SQL contains only SELECT statements.

        Args:
            sql: The SQL to validate.

        Raises:
            SQLValidationError: If the SQL contains non-SELECT statements.
        """
        try:
            ast = self.parse(sql)
        except SQLParseError as e:
            raise SQLValidationError(str(e)) from e

        # Check if the root is a SELECT statement
        if not isinstance(ast, exp.Select):
            # Check for other statement types
            if isinstance(ast, (exp.Insert, exp.Update, exp.Delete)):
                raise SQLValidationError(
                    f"Only SELECT queries are allowed. Found {ast.__class__.__name__} statement.",
                    sql,
                )
            if isinstance(ast, (exp.Drop, exp.Create, exp.Alter)):
                raise SQLValidationError(
                    f"DDL statements ({ast.__class__.__name__}) are not allowed.",
                    sql,
                )
            # For any other statement type
            raise SQLValidationError(
                f"Only SELECT queries are allowed. Found {ast.__class__.__name__} statement.",
                sql,
            )

    def ensure_limit(self, sql: str, default_limit: int = 1000) -> str:
        """Ensure the SQL query has a LIMIT clause.

        Args:
            sql: The SQL query.
            default_limit: The default limit to add if none exists.

        Returns:
            The SQL query with a LIMIT clause.
        """
        try:
            ast = self.parse(sql)
        except SQLParseError:
            # If parsing fails, return the original SQL
            return sql

        if not isinstance(ast, exp.Select):
            return sql

        # Check if LIMIT already exists
        has_limit = any(isinstance(node, exp.Limit) for node in ast.find_all(exp.Limit))

        if not has_limit:
            # Add LIMIT clause
            modified = sqlglot.parse_one(sql, dialect=self.dialect)
            modified = modified.limit(str(default_limit))  # type: ignore[attr-defined]
            result = cast(str, modified.sql(dialect=self.dialect))
            return result

        return sql

    def get_error_location(self, sql: str, error_message: str) -> dict[str, int | None]:
        """Extract error location from sqlglot error message.

        Args:
            sql: The SQL that caused the error.
            error_message: The error message from sqlglot.

        Returns:
            A dict with 'line' and 'column' keys, or None if not found.
        """
        # sqlglot error messages often contain line and column info
        # Format: "Error at line 3, column 5: ..."
        import re

        match = re.search(r"line (\d+), column (\d+)", error_message)
        if match:
            return {"line": int(match.group(1)), "column": int(match.group(2))}

        return {"line": None, "column": None}


def get_parser(db_type: str) -> SQLParser:
    """Get a SQL parser for the specified database type.

    Args:
        db_type: The database type (mysql, postgresql, sqlite).

    Returns:
        A SQLParser instance configured for the database type.
    """
    # Normalize db_type names
    dialect_map = {
        "mysql": "mysql",
        "postgresql": "postgres",
        "postgres": "postgres",
        "sqlite": "sqlite",
    }
    dialect = dialect_map.get(db_type.lower(), "postgres")
    return SQLParser(dialect=dialect)
