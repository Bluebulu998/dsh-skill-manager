window.__ModuleLoader__.load({
  id: '@dsh-local/dsh-skill-manager',
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
.dsc-skill { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
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
          const source = skill.source || 'custom'
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
      }, [data, t])

      const roots = React.useMemo(() => {
        if (data === null) return []
        return (data.roots || []).slice().sort((left, right) => displayRank(left.source) - displayRank(right.source)
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
                        h('span', { className: 'dsc-source-pill' }, sourceLabel(t, root.source)),
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

            groups.map((group) => h('section', { key: group.source, className: 'dsc-source-group' },
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
                group.skills.map((skill) => h('div', { key: skill.path, className: 'dsc-row', role: 'row' },
                  h('div', { className: 'dsc-skill' },
                    h('span', { className: 'dsc-skill-name' }, skill.name),
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
                    disabled: pending[skill.path] === true,
                    label: t('toggleModel'),
                    name: skill.name,
                    onChange: (checked) => { void setFlag(skill, 'modelInvocable', checked) },
                  })),
                  h('div', { className: 'dsc-toggle' }, h(Toggle, {
                    checked: skill.userInvocable !== false,
                    disabled: pending[skill.path] === true,
                    label: t('toggleUser'),
                    name: skill.name,
                    onChange: (checked) => { void setFlag(skill, 'userInvocable', checked) },
                  })),
                  rowErrors[skill.path]
                    ? h('p', { className: 'dsc-row-detail', role: 'alert' }, rowErrors[skill.path])
                    : null,
                )),
              ),
            )),

            h('p', { className: 'dsc-footer-hint' }, t('editHint')),
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