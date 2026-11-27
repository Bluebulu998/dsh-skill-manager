# 技能管理 / Skill manager

左侧栏的全局入口，打开一个跨会话的技能管理页，用来集中查看和切换当前会被本地技能提供器扫描到的技能。它不只展示目录，还可以直接改写每个技能的调用开关。

> 维护/开发请先读源码仓库里的 `AGENTS.md`：架构、数据流、踩过的坑、重载与测试命令都在那里。本文只面向使用者。

- **按来源分组**：页面从上到下依次是用户 `~/.dsh/skills`、用户 `~/.agents/skills`、自定义目录、内置（安装包内的扫描根），然后是项目 `.dsh/skills`、项目 `.agents/skills`。项目根按已注册的工作区逐个解析（最近的 `.git` 祖先），因此不同会话所在的仓库都能出现在同一页。
- **数据来源**：页面直接扫描这些根目录，而不是查询全局技能注册表。技能的识别规则与本地提供器一致：顶层目录里的 `SKILL.md` 或顶层的 `*.md` 文件，frontmatter 必须有合法的 kebab-case `name`、非空 `description`，两个 invocation 字段如果出现，必须是可识别的布尔写法（`true/false/yes/no/on/off/1/0`）。扫描根取自宿主当前组合里的技能提供器配置，包括预设 `dsh-agent-preset` 子行声明的自定义目录。
- **两个可见性开关**：取消「对模型可见」会写入 `disable-model-invocation: true`，取消「用户可调用」会写入 `user-invocable: false`；重新勾选会移除对应字段，恢复默认允许。只改动 `SKILL.md` frontmatter 中的这两个顶级键，其余 frontmatter、注释和正文保持不变。
- **立即生效**：写入后向 `fs/observed` 发送与内建 `edit`/`write` 工具相同的变更观察，技能提供器会同步失效并重新扫描；宿主没有 `fs` 服务、走本地文件回退写时同样发送。写入完成后直接读回该文件确认两个字段已是目标状态。
- **库外语义检索**：`design-library` 的 133 个和 `skills-off` 的 13 个技能从来不在模型目录里，以前只能读 `INDEX.md` 一页页翻。现在用本地 bge-m3 给它们的正文建一份 1024 维索引（`~/.dsh/skill-index/`，可重建缓存），页面上用一句人话就能找到——「这个按钮点着没反应」直接指到 `feedback-patterns`。索引不进同步、不写技能文件，`npm run index` 重建。
- **批量操作**：每行左侧的勾选框选中多行后，顶部会出现一排动作——设为模型可见 / 对模型隐藏 / 允许用户调用 / 禁止用户调用 / 恢复默认。一次扫描 62 个技能逐行点太慢，这里按行发请求，串行写入（写路径带版本校验，并发只会换来一堆冲突）。
- **引用图**：入口技能通常用正文里手写的路径指向子技能。页面会扫这些引用，在行上标「引用 · N」（这条正文指向几个子技能）、「被引用 · N」（谁指向它）、以及红色的「断链 · N」（引用的文件已经不存在）。只认 `.dsh`/`.agents` 下的 `skills` 根和安装包内的 `app.asar/dsh/skills`；删改技能目录名或搬家之后，断链会在这里先暴露，而不是等到任务里读文件失败。
- **扫描根只读展示**：直接展示当前生效的技能根路径与存在状态，不提供新增、删除或修改配置的操作；不存在的目录默认隐藏，标题右侧的按钮可以按需显示；全局目录排在项目根之前。存在的根可以点「打开文件夹」在系统文件管理器中打开。
- **打开文件夹**：Windows 上通过编码后的文件 URI 交给 Explorer，并保留可见窗口——隐藏式启动会连 Explorer 的文件夹窗口一起藏掉，这个坑已经规避；安装包（`.asar`）里的目录无法用文件管理器打开，按钮会禁用并说明原因。
- **安全边界**：服务端每次请求都重新计算当前扫描结果，只接受确实出现在扫描结果里的文件路径；改写前会检查 frontmatter 结构。写入带版本保护：读内容和写盘之间文件被其他程序改动，会返回冲突（`stale_file`）而不是覆盖。宿主提供 `fs` 服务时用它的版本令牌，回退到本地文件写入时用文件的修改时间与大小，两条路都有保护；回退写的临时文件在失败时会删除。

## 限制

- 只显示本地文件系统里的技能：页面只认识本地技能提供器的扫描根。插件用 `ctx.skills.register()` / `registerProvider()` 注册的运行时技能不会出现，也不计入统计——包括随安装包分发的 office、visualize、official-plugins、personalized-pages 等内置技能，它们没有扫描根。
- 同名的技能如果被更高优先级扫描根覆盖，会带 `shadowed` 标记，页面提示里说明改动不影响模型看到的版本；文件层没有可写的 dedupe 信息，所以不会隐藏这些行。
- 内置安装归档（`app.asar`）里的扫描根按「内置」分组展示：行上标「位于安装包内，只读」，两个开关禁用；即使绕过页面直接调用接口，服务端也会以 `read_only_source` 拒绝改写。本机这个根是预设声明的 `dsh-agent-preset/skills`（当前只有 `dsh-doc`），它本身在提供器里算自定义目录，页面按安装包位置把它显示为内置。
- 只编辑 `disable-model-invocation` 与 `user-invocable` 两个字段，不支持编辑技能正文、名称或描述。
- 引用图只解析技能正文里的路径。技能库自己的索引文件（例如 `design-library/INDEX.md` 里写的「★已注册 → 某路径」）不在扫描范围内，那里的过期路径不会被这里标出来，需要单独的 lint。
- 引用图只对「对模型可见」的技能正文取证：被 `disable-model-invocation` 关掉的技能，其正文里的引用不会计入，也不会产生断链提示。
- 页面通过宿主 `/api` 路由读取数据，因此需要 Harness 的 Web 端连接；宿主半未加载时页面会显示错误并可重试。

## 安装

这是一个本地 Bundle：`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，后者只插入一个宿主插件行；浏览器半通过 `dsh.client` 声明为 Web 平台入口。装好后左侧栏出现「技能管理」入口。

1. **解压到长期保留的目录**。本地 Bundle 是链接安装：DSH 只记下这个目录的路径，不复制文件。之后移动或删除目录，插件会失效。
2. 打开 DSH Desktop 的 **插件（Plugins）** → **添加插件（Add plugin）**，选择 `package.json` 所在的那个目录。
3. 左侧栏出现「技能管理」即安装完成。页面若提示宿主半未加载，重启一次 Desktop 再打开。
4. 卸载在插件列表里移除该 Bundle，不会删除你的目录。

包内自带测试，解压后可以自检（需要本机有 Node.js 18 及以上）：

```powershell
npm test
```

要求 **DSH Desktop 0.2.2-rc.1 或更新版本**：插件管理器会校验 `package.json` 的 `engines.dsh`，不满足时直接拒绝安装或激活（`incompatible-version`），不是警告——比你手上更旧的版本只能显式接受版本豁免，那等于自己承担崩溃风险。

这个下限是**实测过的版本**：0.2.2-rc.1 上完整跑过（页面渲染、62 个技能扫描、开关双向写入、`fs/observed` 即时刷新）。插件依赖的四件事在该版本里都已经存在：

| 依赖 | rc.1 里的位置 |
|---|---|
| `connection.fetch.register({ path, methods, requestBody, fetch })` | `@deepseek-ai/dsh-client-connection/lib/index.js` 的 `fetchRoutes` |
| `configEditor.configuration()` → `[{ entry, inherited, override }]` | `@deepseek-ai/dsh-config-editor/lib/index.js` |
| `fs.writeText(target, content, expected, signal, sandboxPolicy)`（五参） | `@deepseek-ai/dsh-fs-sandbox/lib/index.js`（`dsh-fs-local` 只有四参，没有 `sandboxPolicy`） |
| `fs/observed` 失效通知 | 同上的 sandbox 后端；`dsh-experimental-liveshare` 写完后就是这样发的 |

所以旧版本上大概率能跑，但没有实测过，不作为支持承诺。页面依赖 Harness 的 Web 端连接，纯 headless 环境看不到这个入口。