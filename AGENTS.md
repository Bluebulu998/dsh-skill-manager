# 交接文档：技能管理页（skill manager plugin）

给接手这个项目的 agent。先读完本文再动代码；用户手册在 `README.md`，本文只讲实现、坑和操作流程。

## 1. 它是什么、装在哪

- 一个 DSH Desktop 的本地 Bundle，提供左侧栏「技能管理」页：列出当前会被本地技能提供器扫描到的技能、来源根、两个 invocation 开关，并可直接改写对应 `SKILL.md` 的 frontmatter。
- 包名：`@dsh-local/dsh-skill-manager`。2026-11-28 由创建器给的 `@dsh-local/view-f14b8d9a-...` 改成现在这个名字；bundle 列表、插件行 id、`plugin_manager` 的 entryId 都绑定它，再改就要连 profile 安装关系一起动（见下）。
- 项目目录就是本目录（文件夹名与包名一致，都是 `dsh-skill-manager`），也是 profile 的安装目标：
  `C:\Users\Bluebulu998\.dsh\profiles\desktop\created-plugins\dsh-skill-manager`
- 安装关系（不要随手移动目录，也不要只改包名）：
  - profile 的 `package.json` 里有依赖 `"@dsh-local/dsh-skill-manager": "link:C:/Users/.../created-plugins/dsh-skill-manager"`；
  - `node_modules/@dsh-local/dsh-skill-manager` 是指向 `..\..\created-plugins\dsh-skill-manager` 的符号链接；
  - `pnpm-lock.yaml` 里包名键一处，specifier 与 version 各记录一处路径；
  - profile 的 `dsh.profile.bundles` 末尾列了本包；
  - 本包 `cordis.patch.yml` 只插入一行宿主插件：`id: "@dsh-local/dsh-skill-manager:host"`。
- 运行环境：DSH Desktop 0.2.2-rc.5（`DSH_INSTALL_DIR` 在 `app.asar` 内），profile `desktop`，Web GUI 的端口每次启动都可能不同，别硬编码 URL。

### 改名记录（2026-11-28）

做了两次改名：目录名从创建器的 uuid 改成 `dsh-skill-manager`，随后包名从 `@dsh-local/view-f14b8d9a-...` 改成 `@dsh-local/dsh-skill-manager`。同一批清掉了「catalog / 目录」措辞：路由前缀 `/api/dsh-skill-manager/`、panel id `view-f14b8d9a-skill-manager`、locale 命名空间 `skill-manager`、界面文案「技能管理」。

改名要同时处理五处，缺一处宿主会 ENOENT 或插件行消失：

1. 目录本身；
2. 本包 `package.json` 的 `name` 与 `cordis.patch.yml` 的插入 id/name；
3. profile `package.json` 的依赖键与 `dsh.profile.bundles` 条目；
4. `pnpm-lock.yaml` 的包名键（specifier/version 记录的是路径，路径没变就不用动）；
5. `node_modules/@dsh-local/<包名>` 符号链接。

**运行中的进程有 ESM realpath 缓存**：改完链接后，重载仍可能去旧路径找文件。做法是保留旧路径直到完整重启一次；重启后再删旧链接（删前确认它是 SymbolicLink/Junction，不是真目录；删 Junction 用 `cmd /c rmdir`，不要用 `Remove-Item -Recurse`，后者可能顺着链接删到目标目录）。2026-11-28 重启后，uuid 目录 Junction 与旧包名兼容 Junction 都已删除，`node_modules/@dsh-local` 下只剩 `dsh-skill-manager` 一个链接。

## 2. 目录结构

```
package.json          包清单：exports、dsh.bundle.patch、dsh.client、测试脚本
cordis.patch.yml       宿主插件行（唯一一行 insert）
index.js              宿主半：3 条 /api 路由 + 扫描 + frontmatter 改写 + 打开目录
client.js             浏览器半：侧栏入口 + 主页面（React.createElement，无 JSX/无构建）
locale/{zh,en}.json   包级 locale（页面文案实际写在 client.js 的字典里）
icon.svg / README.md  图标、用户文档
scripts/build.mjs     静态检查（清单、exports、语法、locale、patch id）
scripts/test-*.mjs    4 个测试，见 §7
scripts/probe-local.mjs 对本机真实目录跑一次发现，不开窗口、不写文件
```

`client.js` 是手写可读源码，不是打包产物；`scripts/build.mjs` 只做 `node --check` 和清单校验，没有编译步骤。

## 3. 运行时结构

宿主半（`index.js`）：

- `apply(ctx)` → `ctx.inject(['connection'])` → 用 `connection.fetch.register({ path, methods, requestBody:'buffered', fetch })` 注册三条路由：
  - `GET  /api/dsh-skill-manager/inventory`
  - `POST /api/dsh-skill-manager/invocation`
  - `POST /api/dsh-skill-manager/reveal`
- 三道路由都走连接鉴权，所以用 curl 直接打会 401，这是预期的。

浏览器半（`client.js`）：

- `sidebar.panellist` 注册 id `view-f14b8d9a-skill-manager`、order 20；
- `main` 用同一个 key 注册页面；
- 组件卸载时若本面板处于选中状态，调用 `layout.selectPanel(null)` 离开。

响应形状（页面依赖，不要擅自改名）：

```json
{ "ok": true, "generatedAt": "...",
  "roots": [{ "path": "...", "source": "user-dsh", "rank": 400, "exists": true, "isDirectory": true,
              "workspaces": [{ "cwd": "...", "title": "..." }] }],
  "skills": [{ "name": "...", "description": "...", "path": "...", "source": "...", "provider": "filesystem",
               "modelInvocable": true, "userInvocable": true, "workspaces": [], "workspaceTitles": [],
               "rank": 400, "shadowed": false }],
  "warnings": ["..."] }
```

## 4. 数据流

1. **根**：`providerConfigs()` 读 `ctx.configEditor.configuration()`。
   - 直接挂载的 `dsh-skill-filesystem` 行：用合并后的 config。
   - 预设行（`dsh-agent-preset`）：技能提供器在其 `config.plugins` 子列表里，逐个子行读 `config`。
   - 预设里的 `customSkillDirs` 可能是 `!!js` 表达式，读不成字符串；`skippedCustom` 计数后回退到 `packagedPresetSkillsDir()`（由 `DSH_INSTALL_DIR` 推到的 `dsh-agent-preset/skills`）。
2. **扫描**：`discover()` 按根逐个 `scanRoot()`，规则与本地提供器一致：
   - 目录 → `<dir>/SKILL.md`（目录名不参与身份判定）；
   - 文件 → 以 `.md` 结尾（大小写敏感，与提供器相同），身份来自 frontmatter；
   - `.` 开头的条目一律跳过；
   - 单文件上限 1 MiB。
3. **解析**：`readSkillFile()` → `splitFrontmatter()` → `parseFrontmatter()`（轻量 YAML 子集）→ `strictInvocation()`。
   - `name` 必须 kebab-case；`description` 必须非空字符串；
   - `disable-model-invocation` / `user-invocable` 只接受 `true/false/yes/no/on/off/1/0`，其它值整条丢弃（与提供器一样，不是"默认允许"）；
   - 失败的条目不会静默消失，会进 `warnings`（页面上只显示一条通用横幅，文案是 `warnRefresh`）。
4. **合并**：按 `normalizePath(path)` 去重并合并 workspaces；同名冲突按根 rank 标 `shadowed`（页面不渲染这个字段，只在 warnings 里提示）。
5. **写**：`POST /invocation` 只改两个键，保留 BOM/CRLF/注释/正文；`fs.writeText` 走版本保护（`replaceIfVersion`），冲突返回 `409 stale_file`；写后发 `fs/observed`（`{kind:'present', version}`，name `edit`）让提供器同步失效；最后读回文件确认，`refreshed` 反映真实结果（不再轮询注册表）。
6. **打开目录**：`POST /reveal` 校验路径确实是当前根 → `openFolder()`。

## 5. 必须知道的坑（都是踩过的）

1. **不要用 `ctx.skills.snapshot()` 取数据。** 注册表是分层的：profile 根只挂注册表，`dsh-skill-filesystem` 挂在每个 Agent 预设的作用域里；宿主级快照永远是空数组。页面因此自己扫盘。
2. **`configEditor` 只直接暴露顶层行。** 预设的技能配置在 `config.plugins` 里，之前的 bug 就是只匹配了顶层 `entry.name`。
3. **`windowsHide: true` 会连 Explorer 文件夹窗口一起隐藏**（`SW_HIDE`），表现就是"点了没反应"。打开目录必须保持可见窗口。
4. **Explorer 按逗号/等号拆命令行**，直接传原始路径可能打开别的东西且不报错；必须用 `pathToFileURL(..., { windows:true })` 编码，把非 ASCII 转义还原、`,`/`=` 转义。
5. **`.asar` 里的目录打不开**：宿主返回 `422 unsupported_root`，客户端按钮直接禁用。
6. **页面排序 ≠ 提供器优先级。** 客户端用 `SOURCE_DISPLAY`（全局在前：user-dsh、user-agents、custom、bundled，然后 project-*）；服务端仍按 provider rank 返回。两处都要改，否则根列表和技能分组顺序会不一致。
7. **不存在的根默认隐藏**，`missingRootCount` > 0 时才出现「显示不存在的目录 (N)」开关。
8. **轻量 frontmatter 解析不是完整 YAML。** 锚点、把 `name` 写成嵌套结构、引号形式的键等边缘写法可能和提供器判断不同。遇到"页面不显示但模型能看到"的技能，先怀疑这里。
9. **页面文案在两处**：`client.js` 的 `ZH`/`EN` 字典，以及 `locale/*.json` 的包元数据。改文案改前者。
10. **别根据 GUI 端口/历史 URL 做判断**；每次启动都变。

## 6. 改完如何生效

- **只改文档 / package.json scripts**：不需要重载。
- **改了 `index.js` 或 `client.js`**：插件行 off/on 一次即可让宿主半重新导入：
  1. `plugin_manager` `list_plugins` 确认 entryId 是 `include:@dsh-local/dsh-skill-manager:host`；
  2. `set_plugin` `{ target: "include:@dsh-local/dsh-skill-manager:host", enabled: false }`；
  3. 同样参数 `enabled: true`。
  - 两次调用都应为 `application: "applied"`；profile 的 `cordis.patch.yml` 不会留下开关残留（已确认）。
  - 浏览器半可能仍缓存旧的 `client.js`，让用户按一次 Ctrl+R 刷新窗口；宿主侧改动不需要刷新。
- **改包名/目录/`cordis.patch.yml` 的插入 id**：必须同步 profile 的 `package.json`、`pnpm-lock.yaml`、`node_modules` 链接与 `dsh.profile.bundles`，否则插件消失；重启前保留旧链接。

## 7. 测试与自检

Desktop 安装里 PATH 上不一定有 `node`，用运行时自带的 Electron 当 Node：

```powershell
$p = 'C:\Users\Bluebulu998\.dsh\profiles\desktop\created-plugins\dsh-skill-manager'
$env:ELECTRON_RUN_AS_NODE = '1'
& $env:DSH_NODE_EXECUTABLE "$p\scripts\test-host.mjs"
& $env:DSH_NODE_EXECUTABLE "$p\scripts\test-frontmatter.mjs"
& $env:DSH_NODE_EXECUTABLE "$p\scripts\test-client.mjs"
& $env:DSH_NODE_EXECUTABLE "$p\scripts\test-page.mjs"
& $env:DSH_NODE_EXECUTABLE "$p\scripts\build.mjs"
```

- `test-host`：路由注册、扫描结果、写 frontmatter、未知路径拒绝、非根目录拒绝。
- `test-frontmatter`：改写逻辑（BOM、CRLF、引号键、恢复默认）。
- `test-client`：槽位注册、locale、卸载时的 panel 释放。
- `test-page`：最小 React 运行时渲染页面，覆盖全局优先排序、缺失根默认隐藏/按需展开、勾选保存、打开目录路由。
- 想只看扫描结果不打页面：`& $env:DSH_NODE_EXECUTABLE "$p\scripts\probe-local.mjs" "D:\某个工作区"`。

## 8. 已知限制与未做的事

- 只显示文件系统里的技能；用 `ctx.skills.register()` 注册的运行时技能不出现。
- 同名覆盖只标记不隐藏；`shadowed` 字段没进 UI。
- 扫描根只读；增删改根要改预设，页面不提供。
- 不解析 `metadata`、不支持把 `name`/`description` 写成非标量。
- 打开目录只支持 Windows（代码里有 darwin/linux 分支但没有在真机验证）。
- 有 git 仓库（2026-11-28 初始化，分支 `master`）；改前 commit，`git diff` 就是 review。仓库只收本目录，不要把 `node_modules` 或 profile 文件提交进来。

## 9. 下一步可能的方向

1. 把 `shadowed` 做成可见徽标并支持按工作区过滤（现在多工作区时同名技能只是被提示）。
2. 扫描根支持"复制路径"，以及只读模式下显示配置来源（预设 id）。
3. Windows 之外验证 `open` / `xdg-open` 分支。
4. 若 DSH 提供 scope-aware 的 skills 读取入口，可替换自研扫描，去掉解析差异。