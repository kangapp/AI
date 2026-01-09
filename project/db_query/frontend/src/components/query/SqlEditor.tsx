/**
 * SQL Editor component using Monaco Editor.
 */

import { useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { Button, Space, Typography } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  loading?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onExecute,
  loading = false,
  placeholder = "在此输入 SELECT 查询...",
  readOnly = false,
}) => {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure SQL language
    monaco.languages.setLanguageConfiguration("sql", {
      comments: {
        lineComment: "--",
        blockComment: ["/*", "*/"],
      },
      brackets: [
        ["(", ")"],
        ["[", "]"],
      ],
      autoClosingPairs: [
        { open: "(", close: ")" },
        { open: "[", close: "]" },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
    });

    // Register SQL completion provider
    monaco.languages.registerCompletionItemProvider("sql", {
      provideCompletionItems: () => {
        const keywords = [
          "SELECT",
          "FROM",
          "WHERE",
          "JOIN",
          "LEFT JOIN",
          "RIGHT JOIN",
          "INNER JOIN",
          "ON",
          "AND",
          "OR",
          "NOT",
          "IN",
          "LIKE",
          "BETWEEN",
          "IS NULL",
          "IS NOT NULL",
          "ORDER BY",
          "GROUP BY",
          "HAVING",
          "LIMIT",
          "OFFSET",
          "DISTINCT",
          "COUNT",
          "SUM",
          "AVG",
          "MIN",
          "MAX",
          "AS",
          "ASC",
          "DESC",
        ];

        return {
          suggestions: keywords.map((keyword) => ({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            detail: keyword,
          })),
        };
      },
    });

    // Enable keyboard shortcut for execute (Ctrl+Enter / Cmd+Enter)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onExecute();
    });
  };

  const handleFormat = () => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const currentValue = editor.getValue();

      // Basic SQL formatting
      const formatted = formatSQL(currentValue);

      // Update React state through onChange callback
      onChange(formatted);
    }
  };

  // Basic SQL formatter
  const formatSQL = (sql: string): string => {
    // Remove extra whitespace
    let formatted = sql.trim().replace(/\s+/g, " ");

    // Add newlines after major keywords
    const keywords = ["SELECT", "FROM", "WHERE", "JOIN", "LEFT JOIN", "RIGHT JOIN",
                     "INNER JOIN", "ON", "AND", "OR", "ORDER BY", "GROUP BY", "HAVING",
                     "LIMIT", "OFFSET", "UNION", "INTERSECT", "EXCEPT"];

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, "gi");
      formatted = formatted.replace(regex, `\n${keyword}`);
    });

    // Fix indentation and remove empty lines
    const lines = formatted.split("\n").filter(line => line.trim());
    let indentLevel = 0;
    const indentedLines: string[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();

      // Decrease indent after certain keywords
      if (trimmed.match(/^(FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|GROUP BY|HAVING|ORDER BY|UNION|INTERSECT|EXCEPT)/i)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Add current line with indentation
      indentedLines.push("  ".repeat(indentLevel) + trimmed);

      // Increase indent after certain keywords
      if (trimmed.match(/^(SELECT|FROM|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|WHERE|AND|OR|GROUP BY|HAVING|ORDER BY)$/i)) {
        indentLevel++;
      }
    });

    return indentedLines.join("\n");
  };

  return (
    <div style={{ border: "1px solid #d9d9d9", borderRadius: "6px" }}>
      <div
        style={{
          borderBottom: "1px solid #d9d9d9",
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#fafafa",
        }}
      >
        <Space>
          <Text strong>SQL 查询</Text>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            Ctrl+Enter 执行
          </Text>
        </Space>
        <Space>
          <Button size="small" onClick={handleFormat}>
            格式化
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={onExecute}
            loading={loading}
          >
            执行
          </Button>
        </Space>
      </div>
      <Editor
        height="300px"
        defaultLanguage="sql"
        value={value}
        onChange={(newValue) => onChange(newValue || "")}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          placeholder,
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          parameterHints: { enabled: true },
        }}
        theme="vs-light"
      />
    </div>
  );
};
