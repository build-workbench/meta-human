# CLAUDE.md

以 `AGENTS.md` 为仓库规范指南。

## 常用命令

```bash
npm run dev
npm run typecheck
npm run lint
npm run test:run
npm run build:pages
```

## 工作规则

1. 保持在 `master` 分支。
2. 使用 `@/` 导入。
3. `core/` 不引入 React。
4. 服务通过 `useXStore.getState()` 与 Zustand 交互。
5. 每个外部依赖路径都需要降级方案。
6. 项目历史只更新根目录 `CHANGELOG.md`。
7. GitHub Pages 和文档不做更新日志导航。
