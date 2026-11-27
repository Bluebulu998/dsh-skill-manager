window.__ModuleLoader__.load({
  id: '@bluebulu998/dsh-skill-manager',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'skill-manager'
    const PANEL_ID = 'view-f14b8d9a-skill-manager'
    const INVENTORY_PATH = '/api/dsh-skill-manager/inventory'
    const INVOCATION_PATH = '/api/dsh-skill-manager/invocation'
    const REVEAL_PATH = '/api/dsh-skill-manager/reveal'

    // Display order, not provider priority: global roots are the ones a user
    // reaches for most often, so they lead the page instead of sitting below
    // every project root.
    const SOURCE_DISPLAY = {
      'user-dsh': 10,
      'user-agents': 20,
      custom: 30,
      bundled: 40,
      'project-dsh': 100,
      'project-agents': 110,
    }

    function displayRank(source) {
      return SOURCE_DISPLAY[source] !== undefined ? SOURCE_DISPLAY[source] : 900
    }

    function isArchivePath(path) {
      return typeof path === 'string' && /\.asar([\\/]|$)/i.test(path)
    }

    // The shipped preset mounts its packaged skills as a custom directory, but
    // a path inside the installation archive ships with the app: show it as
    // Bundled so the page does not present it as a user-owned custom root.
    function effectiveSource(source, path) {
      return isArchivePath(path) ? 'bundled' : source
    }

    // The two invocation keys are the whole policy surface, so they also define
    // the three states a row can be in. Kept as one function: the badge and the
    // filter must never disagree about what "disabled" means.
    function policyStateOf(skill) {
      if (skill.modelInvocable === false) return skill.userInvocable === false ? 'off' : 'user'
      return 'model'
    }

    function matchesVisibility(skill, visibility) {
      if (visibility === 'all') return true
      return policyStateOf(skill) === visibility
    }

    // Name and description only: scanning file paths or bodies here would make
    // the box behave differently depending on where a skill happens to live.
    function formatBytes(bytes) {
      if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '—'
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    function matchesQuery(skill, query) {
      const needle = query.trim().toLowerCase()
      if (needle.length === 0) return true
      if (skill.name.toLowerCase().includes(needle)) return true
      return typeof skill.description === 'string' && skill.description.toLowerCase().includes(needle)
    }

    const ZH = {
      panel: '技能管理',
      title: '技能管理',
      subtitle: '按来源查看当前会被扫描到的技能。勾选会直接改写对应 SKILL.md 的 frontmatter，保存后立即生效；只列出有磁盘 SKILL.md 的本地技能。',
      refresh: '重新扫描',
      refreshing: '扫描中…',
      rootsTitle: '扫描根目录',
      rootsHint: '只读展示 · 由当前的本地技能提供器决定',
      showMissing: '显示不存在的目录',
      hideMissing: '隐藏不存在的目录',
      noRoots: '没有可用的扫描根目录',
      rootArchive: '位于安装包内，无法在文件管理器中打开',
      rootExists: '存在',
      missing: '不存在',
      openFolder: '打开文件夹',
      opening: '打开中…',
      editHint: '勾选即改写文件；取消勾选会移除对应的限制字段。',
      archiveHint: '位于安装包内，只读',
      refRouter: '引用',
      refLeaf: '被引用',
      refBroken: '断链',
      visibilityAll: '全部',
      visibilityModel: '模型可见',
      visibilityUser: '仅用户',
      visibilityOff: '已关闭',
      stateModel: '模型可见',
      stateUser: '仅用户可调',
      stateOff: '已关闭',
      viewBySource: '按来源',
      viewByHierarchy: '按层级',
      roleRouter: '入口',
      roleMiddle: '双向',
      roleLeaf: '子技能',
      roleStandalone: '独立',
      overviewTitle: '策略概览',
      overviewRouter: '入口',
      overviewMiddle: '双向',
      overviewLeaf: '子技能',
      overviewStandalone: '独立',
      overviewArchived: '已归档',
      hierarchyHint: '每个入口技能是一个分支：它用正文里的路径指向子技能，子技能默认关在只读通道里，不占模型目录。',
      leafOf: '子技能',
      leafCount: '个子技能',
      branchNoLeaves: '这个分支没有指向任何子技能（路径可能已断，或它只是被引用）。',
      archiveTitle: '已移出扫描根',
      archiveNote: '放在 skills-off 里，不被加载：模型看不见，斜杠命令也调不到。要恢复就把它移回 skills。',
      expand: '展开',
      collapse: '收起',
      pickSkill: '选择',
      sizeHint: '这个文件的正文大小。只有被读取时才进上下文。',
      branchCostHint: '这个分支下所有子技能的正文合计。',
      residentCost: '常驻',
      lazyCost: '按需',
      charUnit: '字符',
      residentHint: '这些技能的描述在每一轮请求里都会进上下文，构成模型的技能目录。',
      lazyHint: '这些正文只在被读取时才进上下文，平时不占成本。',
      bulkSelected: '已选',
      bulkRunning: '更新中',
      bulkDone: '完成',
      bulkFailed: '失败',
      bulkModelOn: '设为模型可见',
      bulkModelOff: '对模型隐藏',
      bulkUserOn: '允许用户调用',
      bulkUserOff: '禁止用户调用',
      bulkRestore: '恢复默认',
      bulkClear: '取消选择',
      searchPlaceholder: '搜索技能名或描述',
      selectAll: '全选',
      selectNone: '清空选择',
      runtimeNote: '由插件在运行时注册的内置技能没有磁盘扫描根，不会出现在这里（例如 office、visualize 等）。',
      columnSkill: '技能',
      modelColumn: '对模型可见',
      userColumn: '用户可调用',
      toggleModel: '对模型可见',
      toggleUser: '用户可调用',
      empty: '当前扫描根目录下没有技能',
      emptyHint: '在某个扫描根的顶层放置 <name>/SKILL.md 或 <name>.md 后刷新。',
      loading: '正在读取技能列表…',
      retry: '重试',
      loadFailed: '读取技能列表失败',
      refreshPending: '已保存。技能列表的刷新稍有延迟，模型将在下一次扫描后看到新状态。',
      skillCount: '个技能',
      rootsCount: '个根目录',
      sourceLabel: '来源',
      warnRefresh: '扫描未完成，列表可能不完整。',
      'source.project-dsh': '项目 · DSH',
      'source.project-agents': '项目 · Agents',
      'source.custom': '自定义目录',
      'source.user-dsh': '用户 · DSH',
      'source.user-agents': '用户 · Agents',
      'source.bundled': '内置',
      'error.generic': '操作失败，请重试。',
      'error.network': '无法连接到 Harness 主机。',
      'error.skills_unavailable': '当前配置没有挂载技能注册表。',
      'error.skill_not_found': '该文件不再是当前扫描到的技能，请重新扫描。',
      'error.read_failed': '无法读取 SKILL.md。',
      'error.write_failed': '无法写入 SKILL.md。',
      'error.stale_file': '文件在读取后被其他程序修改，请重新扫描后再试。',
      'error.frontmatter_missing': '该技能文件没有 YAML frontmatter。',
      'error.frontmatter_invalid': '改写后 frontmatter 缺少 name 或 description。',
      'error.read_only_source': '该内置技能位于只读安装目录，不能改写。',
      'error.unknown_root': '该目录不是当前的扫描根目录。',
      'error.missing_root': '该扫描根目录不存在。',
      'error.unsupported_root': '该目录在安装包内，无法用文件管理器打开。',
      'error.reveal_failed': '无法打开文件夹。',
    }

    const EN = {
      panel: 'Skill manager',
      title: 'Skill manager',
      subtitle: 'Browse the skills the local scan currently exposes, grouped by source. Ticking a box rewrites that skill’s SKILL.md frontmatter and takes effect immediately; only local skills with an on-disk SKILL.md are listed.',
      refresh: 'Rescan',
      refreshing: 'Scanning…',
      rootsTitle: 'Scan roots',
      rootsHint: 'Read-only · decided by the active local skill provider',
      showMissing: 'Show missing roots',
      hideMissing: 'Hide missing roots',
      noRoots: 'No usable scan roots',
      rootArchive: 'Inside the install archive; cannot open in the file manager',
      rootExists: 'Present',
      missing: 'Missing',
      openFolder: 'Open folder',
      opening: 'Opening…',
      editHint: 'Ticking rewrites the file; clearing removes the corresponding restriction key.',
      archiveHint: 'Inside the install archive; read-only',
      refRouter: 'Refs',
      refLeaf: 'Referenced',
      refBroken: 'Broken',
      visibilityAll: 'All',
      visibilityModel: 'Model-visible',
      visibilityUser: 'User only',
      visibilityOff: 'Disabled',
      stateModel: 'Model-visible',
      stateUser: 'User only',
      stateOff: 'Disabled',
      viewBySource: 'By source',
      viewByHierarchy: 'By layer',
      roleRouter: 'Entry',
      roleMiddle: 'Both',
      roleLeaf: 'Sub-skill',
      roleStandalone: 'Standalone',
      overviewTitle: 'Policy overview',
      overviewRouter: 'Entry',
      overviewMiddle: 'Both',
      overviewLeaf: 'Sub-skill',
      overviewStandalone: 'Standalone',
      overviewArchived: 'Archived',
      hierarchyHint: 'Every entry skill is a branch: its body points at sub-skills by path, and those stay off the model catalog by default.',
      leafOf: 'Sub-skill',
      leafCount: 'sub-skills',
      branchNoLeaves: 'This branch points at no sub-skill (paths may be broken, or it is only referenced).',
      archiveTitle: 'Moved out of scan roots',
      archiveNote: 'Parked in skills-off and not loaded: invisible to the model and to slash commands. Move it back to skills to restore it.',
      expand: 'Expand',
      collapse: 'Collapse',
      pickSkill: 'Select',
      sizeHint: 'Body size of this file; it enters the context only when read.',
      branchCostHint: 'Total body size across this branch.',
      residentCost: 'Resident',
      lazyCost: 'On demand',
      charUnit: 'chars',
      residentHint: 'These descriptions ride along on every request as the model skill catalog.',
      lazyHint: 'These bodies enter the context only when read; otherwise they cost nothing.',
      bulkSelected: 'Selected',
      bulkRunning: 'Updating',
      bulkDone: 'Done',
      bulkFailed: 'Failed',
      bulkModelOn: 'Show to model',
      bulkModelOff: 'Hide from model',
      bulkUserOn: 'Allow user calls',
      bulkUserOff: 'Disallow user calls',
      bulkRestore: 'Restore defaults',
      bulkClear: 'Clear selection',
      searchPlaceholder: 'Search name or description',
      selectAll: 'Select all',
      selectNone: 'Clear selection',
      runtimeNote: 'Bundled skills that plugins register at runtime have no on-disk scan root, so they are not listed here (for example office or visualize).',
      columnSkill: 'Skill',
      modelColumn: 'Model-visible',
      userColumn: 'User-invocable',
      toggleModel: 'Model-visible',
      toggleUser: 'User-invocable',
      empty: 'No skills in the current scan roots',
      emptyHint: 'Add <name>/SKILL.md or <name>.md at the top level of a scan root, then rescan.',
      loading: 'Reading the skill list…',
      retry: 'Retry',
      loadFailed: 'Could not read the skill list',
      refreshPending: 'Saved. The list refresh is slightly delayed; the model will see the new state after the next scan.',
      skillCount: 'skills',
      rootsCount: 'roots',
      sourceLabel: 'Source',
      warnRefresh: 'The scan was incomplete, so this list may be missing skills.',
      'source.project-dsh': 'Project · DSH',
      'source.project-agents': 'Project · Agents',
      'source.custom': 'Custom directory',
      'source.user-dsh': 'User · DSH',
      'source.user-agents': 'User · Agents',
      'source.bundled': 'Bundled',
      'error.generic': 'The action failed. Try again.',
      'error.network': 'Cannot reach the Harness host.',
      'error.skills_unavailable': 'The skill registry is not mounted in this profile.',
      'error.skill_not_found': 'That file is no longer a scanned skill. Rescan first.',
      'error.read_failed': 'Could not read the SKILL.md file.',
      'error.write_failed': 'Could not write the SKILL.md file.',
      'error.stale_file': 'The file changed after it was read. Rescan and try again.',
      'error.frontmatter_missing': 'This skill file has no YAML frontmatter.',
      'error.frontmatter_invalid': 'The rewritten frontmatter no longer has a name and description.',
      'error.read_only_source': 'This bundled skill lives in a read-only install and cannot be rewritten.',
      'error.unknown_root': 'That directory is not a current scan root.',
      'error.missing_root': 'That scan root does not exist.',
      'error.unsupported_root': 'That directory is inside the install archive and cannot be opened in the file manager.',
      'error.reveal_failed': 'Could not open the folder.',
    }

    const CSS = `
.dsc-page {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font-size: 14px;
  line-height: 1.6;
}
.dsc-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
}
.dsc-content {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 clamp(24px, 4vw, 48px) 48px;
}
.dsc-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-top: 28px;
  margin-bottom: 20px;
}
.dsc-heading-text { min-width: 0; max-width: 640px; }
.dsc-heading h1 {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 500;
}
.dsc-subtitle {
  margin: 8px 0 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
}
.dsc-actions { display: flex; flex: none; align-items: center; gap: 8px; }
.dsc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease;
}
.dsc-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dsc-btn:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
.dsc-btn:disabled { color: var(--dsw-alias-label-caption); cursor: default; opacity: 0.65; }
.dsc-btn-quiet {
  height: 26px;
  padding: 0 10px;
  border-radius: 13px;
  font-size: 12px;
  background: transparent;
}
.dsc-error {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 16px;
  padding: 10px 14px;
  border: 0.5px solid var(--dsw-alias-state-error-primary);
  border-radius: var(--dsw-radius-sm);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
  color: var(--dsw-alias-state-error-primary);
  font-size: 13px;
}
.dsc-error .dsc-btn { margin-left: auto; }
.dsc-card {
  margin-bottom: 24px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}
.dsc-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-module-platform);
}
.dsc-card-head-text { min-width: 0; }
.dsc-roots-empty { margin: 0; padding: 12px 16px; }
.dsc-card-head h2 {
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}
.dsc-hint {
  display: block;
  margin-top: 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.dsc-roots { margin: 0; padding: 0; list-style: none; }
.dsc-root {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.dsc-root:last-child { border-bottom: 0; }
.dsc-source-pill {
  flex: none;
  padding: 1px 8px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent);
  color: var(--dsw-alias-state-business-primary);
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}
.dsc-root-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.dsc-path {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
  font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Consolas, monospace);
  font-size: 12px;
}
.dsc-root-state { flex: none; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.dsc-root-state.is-ok { color: var(--dsw-alias-label-secondary); }
.dsc-root-state.is-missing { color: var(--dsw-alias-state-error-primary); }
.dsc-source-group { margin-bottom: 24px; }
.dsc-group-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 0 4px 8px;
}
.dsc-group-head h2 {
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}
.dsc-group-count { color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.dsc-list {
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}
.dsc-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 116px 116px;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.dsc-row:last-child { border-bottom: 0; }
.dsc-row-head {
  padding-top: 9px;
  padding-bottom: 9px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 18px;
  text-transform: none;
}
.dsc-row-head span:nth-child(2),
.dsc-row-head span:nth-child(3) { text-align: center; }
.dsc-overview {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 12px 0 4px;
}
.dsc-overview-label {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
  margin-right: 2px;
}
.dsc-expand {
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 4px;
}
.dsc-expand:hover { background: var(--dsw-alias-bg-module-platform); }
.dsc-children {
  margin-left: 18px;
  border-left: 1px solid var(--dsw-alias-border-l2);
  padding-left: 6px;
}
.dsc-tree { display: flex; flex-direction: column; gap: 10px; }
.dsc-tree-hint { margin: 0 0 2px; }
.dsc-branch {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  overflow: hidden;
}
.dsc-branch-head {
  background: var(--dsw-alias-bg-module-platform);
  border-left: 3px solid var(--dsw-alias-label-primary);
}
.dsc-branch-head .dsc-skill-name { font-weight: 600; }
.dsc-branch-leaves {
  border-top: 1px solid var(--dsw-alias-border-l2);
  background: color-mix(in srgb, var(--dsw-alias-bg-module-platform) 40%, transparent);
}
.dsc-branch-leaves .dsc-row {
  position: relative;
  padding-left: 42px;
}
.dsc-branch-leaves .dsc-row::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 0;
  bottom: 0;
  border-left: 1px solid var(--dsw-alias-label-tertiary);
}
.dsc-branch-leaves .dsc-row:last-child::before { bottom: 50%; }
.dsc-branch-leaves .dsc-row:last-child::after {
  content: '';
  position: absolute;
  left: 20px;
  top: 50%;
  width: 12px;
  border-top: 1px solid var(--dsw-alias-label-tertiary);
}
.dsc-connector {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  margin-right: 2px;
  flex: none;
}
.dsc-branch-empty { padding: 6px 0 6px 42px; margin: 0; }
.dsc-branch-plain-head {
  background: transparent;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.dsc-branch-title { font-size: 12px; font-weight: 500; }
.dsc-branch-count { font-size: 11px; color: var(--dsw-alias-label-tertiary); }
.dsc-row-nested { background: transparent; }
.dsc-row-nested .dsc-skill-name { font-weight: 400; }
.dsc-tag-role { border: 0.5px solid var(--dsw-alias-border-l2); }
.dsc-tag-role.is-router { color: var(--dsw-alias-label-primary); }
.dsc-tag-role.is-leaf { opacity: 0.75; }
.dsc-search {
  width: 180px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  background: transparent;
  color: inherit;
  font-size: 12px;
}
.dsc-pick { margin: 0 4px 0 0; flex: none; }
.dsc-bulk {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 10px;
  margin: 8px 0;
  border-radius: 8px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-module-platform);
}
.dsc-bulk-count { font-size: 12px; font-weight: 500; white-space: nowrap; }
.dsc-bulk-result { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dsc-bulk-errors { color: var(--dsw-alias-state-error-primary); margin-left: 6px; }
.dsc-bulk-actions { display: flex; gap: 4px; flex-wrap: wrap; margin-left: auto; }
.dsc-archive-group { opacity: 0.82; }
.dsc-row-archived { grid-template-columns: minmax(0, 1fr); }
.dsc-row-archived .dsc-skill-name { font-weight: 400; }
.dsc-skill { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dsc-skill-title { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dsc-readonly {
  flex: none;
  padding: 0 6px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}
.dsc-tag {
  flex: none;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}
.dsc-tag-bad {
  color: var(--dsw-alias-state-error-primary);
  border: 0.5px solid currentColor;
}
.dsc-tag-state.is-off { opacity: 0.55; }
.dsc-filters { display: flex; gap: 4px; margin-right: 4px; }
.dsc-btn.is-active {
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-primary);
}
.dsc-skill-name {
  font-weight: 500;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.dsc-skill-desc {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.dsc-skill-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-caption);
  font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Consolas, monospace);
  font-size: 11px;
  line-height: 16px;
}
.dsc-toggle { display: flex; align-items: center; justify-content: center; }
.dsc-toggle label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 28px;
  padding: 0 4px;
  border-radius: var(--dsw-radius-sm);
  cursor: pointer;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}
.dsc-toggle label:has(input:disabled) { cursor: default; opacity: 0.6; }
.dsc-toggle input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--dsw-alias-state-business-primary);
  cursor: inherit;
}
.dsc-toggle input:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.dsc-row-detail {
  grid-column: 1 / -1;
  margin: 4px 0 0;
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 18px;
}
.dsc-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
}
.dsc-empty strong { display: block; color: var(--dsw-alias-label-primary); font-weight: 500; margin-bottom: 4px; }
.dsc-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: var(--dsw-alias-label-secondary);
}
.dsc-footer-hint {
  margin: 4px 4px 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.dsc-chip-cost {
  border: 0.5px solid var(--dsw-alias-border-l2);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
}
.dsc-chip {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 17px;
}
@media (max-width: 640px) {
  .dsc-content { padding-inline: 16px; }
  .dsc-row { grid-template-columns: minmax(0, 1fr) 84px 84px; }
  .dsc-toggle label span { display: none; }
}
`

    class ApiFailure extends Error {
      constructor(code, message) {
        super(message || code)
        this.code = code
      }
    }

    /**
     * Call one of this package's authenticated `/api` routes.
     * @param {string} path - route path including the leading `/api` segment.
     * @param {object} [init] - fetch options.
     * @returns {Promise<object>} the parsed JSON payload.
     */
    async function apiCall(path, init) {
      const url = new URL(path.slice(1), document.baseURI).href
      const headers = { accept: 'application/json' }
      if (init && init.body !== undefined) headers['content-type'] = 'application/json'
      let response
      try {
        response = await fetch(url, {
          credentials: 'same-origin',
          ...init,
          headers: { ...headers, ...(init && init.headers) },
        })
      } catch {
        throw new ApiFailure('network', '')
      }
      let payload
      try {
        payload = await response.json()
      } catch {
        payload = undefined
      }
      if (!response.ok || payload === undefined || payload.ok === false) {
        throw new ApiFailure(
          payload && typeof payload.code === 'string' ? payload.code : `http_${response.status}`,
          payload && typeof payload.message === 'string' ? payload.message : '',
        )
      }
      return payload
    }

    function fallbackTranslate(key) {
      return ZH[key] !== undefined ? ZH[key] : key
    }

    function translate(t, key) {
      const value = t(key)
      return value === key ? key : value
    }

    function errorText(t, code) {
      const key = `error.${code}`
      const value = t(key)
      return value === key ? t('error.generic') : value
    }

    function sourceLabel(t, source) {
      const key = `source.${source}`
      const value = t(key)
      return value === key ? source : value
    }

    function countText(t, count, unitKey) {
      return `${count} ${t(unitKey)}`
    }

    function PanelIcon(props) {
      activeRef.current = props.active === true
      const size = typeof props.size === 'number' && props.size > 0 ? props.size : 18
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 36 36',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        style: { display: 'block' },
      },
        h('rect', { x: 7.5, y: 7, width: 8, height: 8, rx: 2.2 }),
        h('path', { d: 'M10.4 11.2l1.5 1.5 2.5-2.7' }),
        h('path', { d: 'M20.5 10.8h8' }),
        h('rect', { x: 7.5, y: 20.5, width: 8, height: 8, rx: 2.2 }),
        h('path', { d: 'M20.5 24.3h8' }),
        h('path', { d: 'M20.5 16.6h5.5' }),
        h('path', { d: 'M20.5 30.1h5.5' }),
      )
    }

    function Toggle(props) {
      const { checked, disabled, label, onChange, name } = props
      return h('label', { className: 'dsc-toggle-label' },
        h('input', {
          type: 'checkbox',
          checked,
          disabled,
          'aria-label': `${label} ${name}`,
          onChange: (event) => onChange(event.target.checked),
        }),
        h('span', null, label),
      )
    }

    function ManagerPage(props) {
      const t = typeof props.t === 'function' ? props.t : fallbackTranslate
      const [status, setStatus] = React.useState('loading')
      const [data, setData] = React.useState(null)
      const [loadError, setLoadError] = React.useState(null)
      const [refreshing, setRefreshing] = React.useState(false)
      const [pending, setPending] = React.useState({})
      const [rowErrors, setRowErrors] = React.useState({})
      const [revealPending, setRevealPending] = React.useState({})
      const [revealErrors, setRevealErrors] = React.useState({})
      const [showMissing, setShowMissing] = React.useState(false)
      const [visibility, setVisibility] = React.useState('all')
      const [query, setQuery] = React.useState('')
      // 'source' keeps the old flat view; 'hierarchy' folds routers and their
      // leaves into one outline. Collapsed by default: 62 flat rows is the noise
      // this view exists to remove.
      const [viewMode, setViewMode] = React.useState('source')
      const [expanded, setExpanded] = React.useState(() => new Set())
      // Bulk editing: the sweep that used to mean 62 hand-toggled checkboxes.
      // Selection lives by path so a rescan keeps it stable.
      const [selected, setSelected] = React.useState(() => new Set())
      const [bulkBusy, setBulkBusy] = React.useState(false)
      const [bulkDone, setBulkDone] = React.useState(0)
      const [bulkResult, setBulkResult] = React.useState(null)
      const alive = React.useRef(true)
      const requestId = React.useRef(0)

      React.useEffect(() => {
        alive.current = true
        return () => { alive.current = false }
      }, [])

      const load = React.useCallback(async (manual) => {
        const id = requestId.current + 1
        requestId.current = id
        if (manual) setRefreshing(true)
        else setStatus('loading')
        try {
          const payload = await apiCall(INVENTORY_PATH)
          if (!alive.current || requestId.current !== id) return
          setData(payload)
          setLoadError(null)
          setStatus('ready')
        } catch (error) {
          if (!alive.current || requestId.current !== id) return
          setLoadError(error && error.code ? error.code : 'generic')
          setStatus(data === null ? 'error' : 'ready')
        } finally {
          if (alive.current && requestId.current === id) setRefreshing(false)
        }
      }, [data])

      React.useEffect(() => { void load(false) }, [])

      const setFlag = React.useCallback(async (skill, field, checked) => {
        const previous = {
          modelInvocable: skill.modelInvocable,
          userInvocable: skill.userInvocable,
        }
        setPending((current) => ({ ...current, [skill.path]: true }))
        setRowErrors((current) => {
          if (current[skill.path] === undefined) return current
          const next = { ...current }
          delete next[skill.path]
          return next
        })
        setData((current) => current === null ? current : {
          ...current,
          skills: current.skills.map((entry) => entry.path === skill.path ? { ...entry, [field]: checked } : entry),
        })
        try {
          const result = await apiCall(INVOCATION_PATH, {
            method: 'POST',
            body: JSON.stringify({ path: skill.path, [field]: checked }),
          })
          const invocation = result.invocation || {}
          if (!alive.current) return
          setData((current) => current === null ? current : {
            ...current,
            skills: current.skills.map((entry) => entry.path === skill.path ? {
              ...entry,
              modelInvocable: typeof invocation.modelInvocable === 'boolean' ? invocation.modelInvocable : entry.modelInvocable,
              userInvocable: typeof invocation.userInvocable === 'boolean' ? invocation.userInvocable : entry.userInvocable,
            } : entry),
          })
          if (result.refreshed === false) {
            setRowErrors((current) => ({ ...current, [skill.path]: t('refreshPending') }))
          }
        } catch (error) {
          if (!alive.current) return
          setData((current) => current === null ? current : {
            ...current,
            skills: current.skills.map((entry) => entry.path === skill.path ? { ...entry, ...previous } : entry),
          })
          setRowErrors((current) => ({ ...current, [skill.path]: errorText(t, error && error.code ? error.code : 'generic') }))
        } finally {
          if (alive.current) {
            setPending((current) => {
              const next = { ...current }
              delete next[skill.path]
              return next
            })
          }
        }
      }, [t])

      const reveal = React.useCallback(async (root) => {
        setRevealPending((current) => ({ ...current, [root.path]: true }))
        setRevealErrors((current) => {
          if (current[root.path] === undefined) return current
          const next = { ...current }
          delete next[root.path]
          return next
        })
        try {
          await apiCall(REVEAL_PATH, { method: 'POST', body: JSON.stringify({ path: root.path }) })
        } catch (error) {
          if (!alive.current) return
          setRevealErrors((current) => ({ ...current, [root.path]: errorText(t, error && error.code ? error.code : 'generic') }))
        } finally {
          if (alive.current) {
            setRevealPending((current) => {
              const next = { ...current }
              delete next[root.path]
              return next
            })
          }
        }
      }, [t])

      const groups = React.useMemo(() => {
        if (data === null) return []
        const map = new Map()
        for (const skill of data.skills) {
          if (!matchesVisibility(skill, visibility)) continue
          if (!matchesQuery(skill, query)) continue
          const source = effectiveSource(skill.source || 'custom', skill.path)
          if (!map.has(source)) map.set(source, [])
          map.get(source).push(skill)
        }
        return [...map.entries()]
          .map(([source, skills]) => ({
            source,
            label: sourceLabel(t, source),
            rank: displayRank(source),
            skills: skills.slice().sort((left, right) => left.name.localeCompare(right.name)),
          }))
          .sort((left, right) => left.rank - right.rank || left.source.localeCompare(right.source))
      }, [data, t, visibility, query])

      // Policy overview: one number per role, so "what shape is my skill set in"
      // is readable without scrolling 62 rows.
      const overview = React.useMemo(() => {
        const counts = { router: 0, middle: 0, leaf: 0, standalone: 0 }
        for (const skill of (data && data.skills) || []) {
          const role = typeof skill.role === 'string' ? skill.role : 'standalone'
          counts[role in counts ? role : 'standalone'] += 1
        }
        return counts
      }, [data])

      const archivedSkills = React.useMemo(
        () => ((data && data.archivedSkills) || []).slice(),
        [data],
      )

      // Two different bills. A description is paid on every request (it is the
      // skill catalog the model reads); a body is paid only when something reads
      // the file. Small numbers there, large numbers here — that is the whole
      // point of routing through an entry skill.
      const costs = React.useMemo(() => {
        const empty = { residentChars: 0, residentCount: 0, lazyBytes: 0, lazyCount: 0 }
        if (data === null) return empty
        let residentChars = 0
        let residentCount = 0
        let lazyBytes = 0
        let lazyCount = 0
        for (const skill of data.skills) {
          if (skill.modelInvocable !== false) {
            residentChars += typeof skill.description === 'string' ? skill.description.length : 0
            residentCount += 1
          }
          if (skill.role === 'leaf' || skill.role === 'middle') {
            lazyBytes += typeof skill.bytes === 'number' ? skill.bytes : 0
            lazyCount += 1
          }
        }
        return { residentChars, residentCount, lazyBytes, lazyCount }
      }, [data])

      const hierarchy = React.useMemo(() => {
        if (data === null) return { sections: [], rest: [] }
        const visible = data.skills
          .filter((skill) => matchesVisibility(skill, visibility))
          .filter((skill) => matchesQuery(skill, query))
        const byName = new Map(visible.map((skill) => [skill.name, skill]))
        const routers = visible.filter((skill) => skill.role === 'router' || skill.role === 'middle')
        const claimed = new Set()
        const sections = routers.map((router) => {
          const children = (Array.isArray(router.references) ? router.references : [])
            .map((ref) => (typeof ref.target === 'string' ? byName.get(ref.target) : undefined))
            .filter((child) => child !== undefined)
          for (const child of children) claimed.add(child.name)
          return { router, children }
        })
        const routerNames = new Set(routers.map((skill) => skill.name))
        const rest = visible.filter((skill) => !routerNames.has(skill.name) && !claimed.has(skill.name))
        return { sections, rest }
      }, [data, visibility, query])

      const toggleExpanded = (name) => {
        setExpanded((current) => {
          const next = new Set(current)
          if (next.has(name)) next.delete(name)
          else next.add(name)
          return next
        })
      }

      const toggleSelected = (path) => {
        setSelected((current) => {
          const next = new Set(current)
          if (next.has(path)) next.delete(path)
          else next.add(path)
          return next
        })
      }

      // One request per row, strictly serial: the writer is version-checked, and
      // firing them in parallel just turns a clean sweep into a pile of 409s.
      const applyBulk = async (change) => {
        if (bulkBusy || data === null) return
        const targets = data.skills.filter((skill) => selected.has(skill.path))
        if (targets.length === 0) return
        setBulkBusy(true)
        setBulkDone(0)
        setBulkResult(null)
        let applied = 0
        const failures = []
        for (const skill of targets) {
          try {
            await apiCall(INVOCATION_PATH, {
              method: 'POST',
              body: JSON.stringify({ path: skill.path, ...change }),
            })
            applied += 1
          } catch (error) {
            failures.push(`${skill.name}: ${error.message}`)
          }
          setBulkDone(applied + failures.length)
        }
        setBulkBusy(false)
        setBulkResult({ applied, failures })
        setSelected(new Set())
        await load()
      }

      const roots = React.useMemo(() => {
        if (data === null) return []
        return (data.roots || []).slice().sort((left, right) => displayRank(effectiveSource(left.source, left.path)) - displayRank(effectiveSource(right.source, right.path))
          || left.rank - right.rank
          || left.path.localeCompare(right.path))
      }, [data])

      const missingRootCount = React.useMemo(
        () => roots.filter((root) => !root.exists || !root.isDirectory).length,
        [roots],
      )
      const visibleRoots = showMissing ? roots : roots.filter((root) => root.exists && root.isDirectory)

      const warningText = data && Array.isArray(data.warnings) && data.warnings.length > 0
        ? t('warnRefresh')
        : null

      if (status === 'loading') {
        return h('div', { className: 'dsc-page' },
          h('style', null, CSS),
          h('div', { className: 'dsc-scroll' },
            h('div', { className: 'dsc-content' },
              h('div', { className: 'dsc-heading' },
                h('div', { className: 'dsc-heading-text' },
                  h('h1', null, t('title')),
                  h('p', { className: 'dsc-subtitle' }, t('subtitle')),
                ),
              ),
              h('div', { className: 'dsc-loading' }, t('loading')),
            ),
          ),
        )
      }

      const renderSkillRow = (skill, options = {}) => {
        const archived = isArchivePath(skill.path)
        // The reference graph, computed by the host: how many leaves this body
        // points at, how many of those are gone, and who points here.
        const references = Array.isArray(skill.references) ? skill.references : []
        const brokenLinks = references.filter((ref) => ref.exists === false && ref.archive !== true).length
        const referencedBy = Array.isArray(skill.referencedBy) ? skill.referencedBy : []
        const state = policyStateOf(skill)
        const children = options.children ?? []
        const expandable = children.length > 0
        const expandedHere = expandable && expanded.has(skill.name)
        const roleKey = skill.role === 'middle' ? 'Middle' : skill.role === 'router' ? 'Router' : skill.role === 'leaf' ? 'Leaf' : 'Standalone'
        const row = h('div', { className: `dsc-row${options.indent ? ' dsc-row-nested' : ''}`, role: 'row' },
          h('div', { className: 'dsc-skill' },
            h('div', { className: 'dsc-skill-title' },
              options.connector
                ? h('span', { className: 'dsc-connector', 'aria-hidden': 'true' }, options.connector)
                : null,
              h('input', {
                type: 'checkbox',
                className: 'dsc-pick',
                checked: selected.has(skill.path),
                disabled: archived,
                'aria-label': `${t('pickSkill')} ${skill.name}`,
                onChange: () => toggleSelected(skill.path),
              }),
              expandable
                ? h('button', {
                  type: 'button',
                  className: 'dsc-expand',
                  'aria-expanded': expandedHere,
                  'aria-label': expandedHere ? t('collapse') : t('expand'),
                  onClick: () => toggleExpanded(skill.name),
                }, expandedHere ? '▾' : '▸')
                : null,
              h('span', { className: 'dsc-skill-name' }, skill.name),
              h('span', { className: `dsc-tag dsc-tag-state is-${state}` }, t(`state${state === 'model' ? 'Model' : state === 'user' ? 'User' : 'Off'}`)),
              typeof skill.role === 'string'
                ? h('span', { className: `dsc-tag dsc-tag-role is-${skill.role}` }, t(`role${roleKey}`))
                : null,
              references.length > 0
                ? h('span', { className: 'dsc-tag', title: references.map((ref) => ref.path).join('\n') }, `${t('refRouter')} · ${references.length}`)
                : null,
              brokenLinks > 0
                ? h('span', { className: 'dsc-tag dsc-tag-bad' }, `${t('refBroken')} · ${brokenLinks}`)
                : null,
              referencedBy.length > 0
                ? h('span', { className: 'dsc-tag', title: referencedBy.join('\n') }, `${t('refLeaf')} · ${referencedBy.length}`)
                : null,
              typeof skill.bytes === 'number' && skill.bytes > 0
                ? h('span', { className: 'dsc-tag dsc-tag-size', title: t('sizeHint') }, formatBytes(skill.bytes))
                : null,
              options.cost
                ? h('span', { className: 'dsc-tag dsc-tag-cost', title: t('branchCostHint') }, options.cost)
                : null,
              archived
                ? h('span', { className: 'dsc-readonly' }, t('archiveHint'))
                : null,
            ),
            skill.description
              ? h('p', { className: 'dsc-skill-desc', title: skill.description }, skill.description)
              : null,
            h('code', { className: 'dsc-skill-path', title: skill.path }, skill.path),
            skill.workspaceTitles && skill.workspaceTitles.length > 0
              ? h('span', { className: 'dsc-skill-path' }, skill.workspaceTitles.join(' · '))
              : null,
          ),
          h('div', { className: 'dsc-toggle' }, h(Toggle, {
            checked: skill.modelInvocable !== false,
            disabled: archived || pending[skill.path] === true,
            label: t('toggleModel'),
            name: skill.name,
            onChange: (checked) => { void setFlag(skill, 'modelInvocable', checked) },
          })),
          h('div', { className: 'dsc-toggle' }, h(Toggle, {
            checked: skill.userInvocable !== false,
            disabled: archived || pending[skill.path] === true,
            label: t('toggleUser'),
            name: skill.name,
            onChange: (checked) => { void setFlag(skill, 'userInvocable', checked) },
          })),
          rowErrors[skill.path]
            ? h('p', { className: 'dsc-row-detail', role: 'alert' }, rowErrors[skill.path])
            : null,
        )
        return h(React.Fragment, { key: skill.path },
          row,
          expandedHere
            ? h('div', { className: 'dsc-children' }, children.map((child) => renderSkillRow(child, { indent: true })))
            : null,
        )
      }

      return h('div', { className: 'dsc-page' },
        h('style', null, CSS),
        h('div', { className: 'dsc-scroll' },
          h('div', { className: 'dsc-content' },
            h('div', { className: 'dsc-heading' },
              h('div', { className: 'dsc-heading-text' },
                h('h1', null, t('title')),
                h('p', { className: 'dsc-subtitle' }, t('subtitle')),
              ),
              h('div', { className: 'dsc-actions' },
                h('input', {
                  type: 'search',
                  className: 'dsc-search',
                  placeholder: t('searchPlaceholder'),
                  'aria-label': t('searchPlaceholder'),
                  value: query,
                  onChange: (event) => setQuery(event.target.value),
                }),
                h('div', { className: 'dsc-filters', role: 'group' },
                  [['all', 'visibilityAll'], ['model', 'visibilityModel'], ['user', 'visibilityUser'], ['off', 'visibilityOff']]
                    .map(([value, key]) => h('button', {
                      key: value,
                      type: 'button',
                      className: `dsc-btn dsc-btn-quiet${visibility === value ? ' is-active' : ''}`,
                      'aria-pressed': visibility === value,
                      onClick: () => setVisibility(value),
                    }, t(key))),
                ),
                h('div', { className: 'dsc-filters', role: 'group' },
                  [['source', 'viewBySource'], ['hierarchy', 'viewByHierarchy']]
                    .map(([value, key]) => h('button', {
                      key: value,
                      type: 'button',
                      className: `dsc-btn dsc-btn-quiet${viewMode === value ? ' is-active' : ''}`,
                      'aria-pressed': viewMode === value,
                      onClick: () => setViewMode(value),
                    }, t(key))),
                ),
                h('button', {
                  type: 'button',
                  className: 'dsc-btn',
                  disabled: refreshing,
                  onClick: () => { void load(true) },
                }, refreshing ? t('refreshing') : t('refresh')),
              ),
            ),

            loadError !== null
              ? h('div', { className: 'dsc-error', role: 'alert' },
                h('span', null, `${t('loadFailed')}: ${errorText(t, loadError)}`),
                h('button', {
                  type: 'button',
                  className: 'dsc-btn dsc-btn-quiet',
                  onClick: () => { void load(true) },
                }, t('retry')),
              )
              : null,

            data !== null
              ? h('div', { className: 'dsc-overview' },
                h('span', { className: 'dsc-overview-label' }, t('overviewTitle')),
                h('span', { className: 'dsc-chip' }, `${t('overviewRouter')} ${overview.router + overview.middle}`),
                h('span', { className: 'dsc-chip' }, `${t('overviewLeaf')} ${overview.leaf}`),
                h('span', { className: 'dsc-chip' }, `${t('overviewStandalone')} ${overview.standalone}`),
                archivedSkills.length > 0
                  ? h('span', { className: 'dsc-chip dsc-chip-muted' }, `${t('overviewArchived')} ${archivedSkills.length}`)
                  : null,
                h('span', {
                  className: 'dsc-chip dsc-chip-cost',
                  title: t('residentHint'),
                }, `${t('residentCost')} ${costs.residentChars.toLocaleString()} ${t('charUnit')} · ${costs.residentCount}`),
                costs.lazyBytes > 0
                  ? h('span', {
                    className: 'dsc-chip dsc-chip-cost',
                    title: t('lazyHint'),
                  }, `${t('lazyCost')} ${formatBytes(costs.lazyBytes)} · ${costs.lazyCount}`)
                  : null,
                h('button', {
                  type: 'button',
                  className: 'dsc-btn dsc-btn-quiet',
                  onClick: () => setSelected(new Set(data.skills
                    .filter((skill) => matchesVisibility(skill, visibility) && matchesQuery(skill, query))
                    .map((skill) => skill.path))),
                }, t('selectAll')),
                selected.size > 0
                  ? h('button', {
                    type: 'button',
                    className: 'dsc-btn dsc-btn-quiet',
                    onClick: () => setSelected(new Set()),
                  }, t('selectNone'))
                  : null,
              )
              : null,

            selected.size > 0 || bulkResult !== null
              ? h('div', { className: 'dsc-bulk' },
                h('span', { className: 'dsc-bulk-count' },
                  bulkBusy
                    ? `${t('bulkRunning')} ${bulkDone}/${selected.size}`
                    : `${t('bulkSelected')} ${selected.size}`),
                bulkResult !== null && !bulkBusy
                  ? h('span', { className: 'dsc-bulk-result' },
                    `${t('bulkDone')} ${bulkResult.applied} · ${t('bulkFailed')} ${bulkResult.failures.length}`,
                    bulkResult.failures.length > 0
                      ? h('span', { className: 'dsc-bulk-errors', title: bulkResult.failures.join('\n') }, bulkResult.failures[0])
                      : null,
                  )
                  : null,
                h('div', { className: 'dsc-bulk-actions' },
                  h('button', {
                    type: 'button',
                    className: 'dsc-btn dsc-btn-quiet',
                    disabled: bulkBusy,
                    onClick: () => { void applyBulk({ modelInvocable: true }) },
                  }, t('bulkModelOn')),
                  h('button', {
                    type: 'button',
                    className: 'dsc-btn dsc-btn-quiet',
                    disabled: bulkBusy,
                    onClick: () => { void applyBulk({ modelInvocable: false }) },
                  }, t('bulkModelOff')),
                  h('button', {
                    type: 'button',
                    className: 'dsc-btn dsc-btn-quiet',
                    disabled: bulkBusy,
                    onClick: () => { void applyBulk({ userInvocable: true }) },
                  }, t('bulkUserOn')),
                  h('button', {
                    type: 'button',
                    className: 'dsc-btn dsc-btn-quiet',
                    disabled: bulkBusy,
                    onClick: () => { void applyBulk({ userInvocable: false }) },
                  }, t('bulkUserOff')),
                  h('button', {
                    type: 'button',
                    className: 'dsc-btn dsc-btn-quiet',
                    disabled: bulkBusy,
                    onClick: () => { void applyBulk({ modelInvocable: true, userInvocable: true }) },
                  }, t('bulkRestore')),
                  h('button', {
                    type: 'button',
                    className: 'dsc-btn dsc-btn-quiet',
                    disabled: bulkBusy,
                    onClick: () => { setSelected(new Set()); setBulkResult(null) },
                  }, t('bulkClear')),
                ),
              )
              : null,

            data !== null
              ? h('section', { className: 'dsc-card' },
                h('div', { className: 'dsc-card-head' },
                  h('div', { className: 'dsc-card-head-text' },
                    h('h2', null, t('rootsTitle')),
                    h('span', { className: 'dsc-hint' }, t('rootsHint')),
                  ),
                  missingRootCount > 0
                    ? h('button', {
                      type: 'button',
                      className: 'dsc-btn dsc-btn-quiet',
                      'aria-pressed': showMissing,
                      onClick: () => setShowMissing((current) => !current),
                    }, showMissing
                      ? `${t('hideMissing')} (${missingRootCount})`
                      : `${t('showMissing')} (${missingRootCount})`)
                    : null,
                ),
                visibleRoots.length === 0
                  ? h('p', { className: 'dsc-hint dsc-roots-empty' }, t('noRoots'))
                  : h('ul', { className: 'dsc-roots' },
                    visibleRoots.map((root) => {
                      const present = root.exists && root.isDirectory
                      const archived = isArchivePath(root.path)
                      return h('li', { key: root.path, className: 'dsc-root' },
                        h('span', { className: 'dsc-source-pill' }, sourceLabel(t, effectiveSource(root.source, root.path))),
                        h('div', { className: 'dsc-root-main' },
                          h('code', { className: 'dsc-path', title: root.path }, root.path),
                          root.workspaceTitle
                            ? h('span', { className: 'dsc-hint' }, root.workspaceTitle)
                            : null,
                          archived
                            ? h('span', { className: 'dsc-hint' }, t('rootArchive'))
                            : null,
                          revealErrors[root.path]
                            ? h('span', { className: 'dsc-row-detail' }, revealErrors[root.path])
                            : null,
                        ),
                        h('span', {
                          className: `dsc-root-state ${present ? 'is-ok' : 'is-missing'}`,
                        }, present ? t('rootExists') : t('missing')),
                        h('button', {
                          type: 'button',
                          className: 'dsc-btn dsc-btn-quiet',
                          disabled: !present || archived || revealPending[root.path] === true,
                          onClick: () => { void reveal(root) },
                        }, revealPending[root.path] === true ? t('opening') : t('openFolder')),
                      )
                    }),
                  ),
              )
              : null,

            warningText !== null
              ? h('p', { className: 'dsc-hint', role: 'status' }, warningText)
              : null,

            data !== null && groups.length === 0
              ? h('div', { className: 'dsc-empty' },
                h('strong', null, t('empty')),
                h('span', null, t('emptyHint')),
              )
              : null,

            (viewMode === 'hierarchy'
              ? h('div', { className: 'dsc-tree' },
                h('p', { className: 'dsc-hint dsc-tree-hint' }, t('hierarchyHint')),
                hierarchy.sections.map(({ router, children }) => h('section', {
                  key: router.path,
                  className: 'dsc-branch',
                },
                h('div', { className: 'dsc-branch-head' }, renderSkillRow(router, {
                  cost: children.length > 0
                    ? `${children.length} ${t('leafCount')} · ${formatBytes(children.reduce((sum, child) => sum + (typeof child.bytes === 'number' ? child.bytes : 0), 0))}`
                    : undefined,
                })),
                children.length > 0
                  ? h('div', { className: 'dsc-branch-leaves' },
                    children.map((child) => renderSkillRow(child, { connector: '↳' })))
                  : h('p', { className: 'dsc-hint dsc-branch-empty' }, t('branchNoLeaves')),
                )),
                hierarchy.rest.length > 0
                  ? h('section', { className: 'dsc-branch dsc-branch-plain' },
                    h('div', { className: 'dsc-branch-head dsc-branch-plain-head' },
                      h('span', { className: 'dsc-branch-title' }, t('roleStandalone')),
                      h('span', { className: 'dsc-branch-count' }, String(hierarchy.rest.length)),
                    ),
                    h('div', { className: 'dsc-branch-leaves' },
                      hierarchy.rest.map((skill) => renderSkillRow(skill))),
                  )
                  : null,
              )
              : groups.map((group) => h('section', { key: group.source, className: 'dsc-source-group' },
                h('div', { className: 'dsc-group-head' },
                  h('h2', null, group.label),
                  h('span', { className: 'dsc-group-count' }, countText(t, group.skills.length, 'skillCount')),
                  h('span', { className: 'dsc-chip' }, group.source),
                ),
                h('div', { className: 'dsc-list' },
                  h('div', { className: 'dsc-row dsc-row-head', role: 'row' },
                    h('span', { role: 'columnheader' }, t('columnSkill')),
                    h('span', { role: 'columnheader' }, t('modelColumn')),
                    h('span', { role: 'columnheader' }, t('userColumn')),
                  ),
                  group.skills.map((skill) => renderSkillRow(skill)),
                ),
              ))),

            archivedSkills.length > 0
              ? h('section', { className: 'dsc-source-group dsc-archive-group' },
                h('div', { className: 'dsc-group-head' },
                  h('h2', null, t('archiveTitle')),
                  h('span', { className: 'dsc-group-count' }, String(archivedSkills.length)),
                  h('span', { className: 'dsc-hint' }, t('archiveNote')),
                ),
                h('div', { className: 'dsc-list' },
                  archivedSkills.map((skill) => h('div', { key: skill.path, className: 'dsc-row dsc-row-archived', role: 'row' },
                    h('div', { className: 'dsc-skill' },
                      h('div', { className: 'dsc-skill-title' },
                        h('span', { className: 'dsc-skill-name' }, skill.name),
                        h('span', { className: 'dsc-readonly' }, t('archiveHint')),
                      ),
                      skill.description
                        ? h('p', { className: 'dsc-skill-desc' }, skill.description)
                        : null,
                      h('code', { className: 'dsc-skill-path' }, skill.path),
                    ),
                  )),
                ),
              )
              : null,

            h('p', { className: 'dsc-footer-hint' }, t('editHint')),
            h('p', { className: 'dsc-footer-hint' }, t('runtimeNote')),
          ),
        ),
      )
    }

    const activeRef = { current: false }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const slots = ctx.get('slots')
        if (slots === undefined) return

        const locale = ctx.get('locale')
        if (locale && typeof locale.register === 'function') {
          ctx.effect(() => locale.register(NS, { zh: ZH, en: EN }), 'skill-manager: dictionaries')
        }
        const t = locale && typeof locale.bind === 'function' ? locale.bind(NS) : fallbackTranslate

        slots.inject('sidebar.panellist', () => slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          locale: NS,
          label: () => t('panel'),
        }, PanelIcon))

        slots.inject('main', () => slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, ManagerPage))

        // Leave the page only when this plugin's panel is the selected one.
        // The sidebar gives each row its own selected state, so the icon's last
        // render is the authoritative reading at teardown time.
        ctx.effect(() => () => {
          const layout = ctx.get('layout')
          if (!layout || typeof layout.selectPanel !== 'function') return
          if (activeRef.current !== true) return
          try { layout.selectPanel(null) } catch {}
        }, 'skill-manager: leave panel on unload')
      },
    }
  },
})