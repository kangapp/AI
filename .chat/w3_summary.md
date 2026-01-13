# CLAUDE

## command

### code review commad

帮我参照 @.claude/commands/speckit.specify.md 的结构，think ultra hard，构建一个对 Python 和 Typescript 代码进行深度代码审查的命令，放在 @.claude/commands/deep-code-review.md。主要考虑几个方面：

- 架构和设计：是否考虑 python 和 typescript 的架构和设计最佳实践？是否有清晰的接口设计？是否考虑一定程度的可扩展性
- KISS 原则
- 代码质量：DRY, YAGNI, SOLID, etc. 函数原则上不超过 150 行，参数原则上不超过 7 个。
- 代码风格：是否符合 python 和 typescript 的代码风格指南？是否使用了一致的命名约定？是否考虑了代码的可读性和可维护性？
- 错误处理：是否考虑了所有可能的错误情况？是否使用了适当的异常处理机制？
- 性能优化：是否考虑了代码的性能问题？是否使用了适当的优化技术？
- 设计模式：是否考虑了适当的设计模式？是否使用了适当的设计模式？

review完成后生成markdown文件,必要时可结合mermaid图表说明,放在./spce/reviews/ 下的文件,文件名示例 <topic>-deep-code-review.md

## agent


## Hooks

### Hooks事件
- pretooluse 工具执行前
- posttooluse 工具执行后
- userpromptsubmit 用户提交提示词
- ...

### 配置结构
./claude/setting.json

## Skills