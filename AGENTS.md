# AGENTS.md

本文件为 AI agent 提供代码库开发指引。所有内容必须以**简体中文**书写；技术术语（如 React、TypeScript、Dexie）、代码标识符（函数名、文件路径）、命令行和 Git commit message 可使用英文。

## 语言约束

- 正文、说明、注释一律使用简体中文。
- 技术术语、代码标识符、命令行、配置 key 保留原文。
- 后续新增章节或修改现有内容时必须遵守此约束；已违反的章节需在触及时修正。

## 规则来源

- Cursor 规则：`.cursor/rules/` 或 `.cursorrules` 中未找到。
- Copilot 规则：`.github/copilot-instructions.md` 中未找到。

## 技术栈

- **框架:** React 19
- **语言:** TypeScript（strict 模式）
- **构建工具:** Vite
- **样式:** Tailwind CSS (v4)
- **数据库:** Dexie.js（IndexedDB 封装）
- **UI/动画:** Framer Motion、Lucide React
- **图表:** ECharts

## 仓库布局（实际观察）

- 入口：`index.tsx` 挂载 `App.tsx`，缺失 `#root` 时抛出异常。
- UI：`components/` 存放 React 组件和弹窗。
- 服务/数据：`services/` 存放 API、DB、i18n、设置、主题等。
- 共享类型：`types.ts`（在服务和组件中复用）。
- 样式：`app.css` 加上 Tailwind 工具类。
- 测试：`setupTests.ts` 和可选的 `test/` 夹具。
- Vite 环境类型：`src/vite-env.d.ts`（`src/` 下唯一文件）。

## 构建、Lint、测试

- 安装：`npm install`
- 开发服务器：`npm run dev`（Vite，默认 http://localhost:3000）
- 构建：`npm run build`（先 `tsc` 再 `vite build`）
- 预览构建：`npm run preview`
- Lint 全部：`npm run lint`
- Lint + 修复：`npm run lint:fix`
- Lint 单个文件：`npm run lint -- components/Dashboard.tsx`
- 测试全部（CI）：`npm run test`
- 测试监听（开发）：`npm run test:watch`
- 测试 UI：`npm run test:ui`
- 单个测试文件：`npm run test -- components/Watchlist.test.tsx`
- 按名称运行单个测试：`npm run test -- -t "renders watchlist"`

说明：

- 测试使用 Vitest + React Testing Library + jsdom。
- Setup 文件为 `setupTests.ts`，加载 `@testing-library/jest-dom`。
- 测试类型隔离在 `tsconfig.test.json` 中。
- 测试文件以 `*.test.ts`/`*.test.tsx` 形式添加在源文件附近或 `__tests__/` 中。

## 工具与配置

- 包管理器：npm（项目为 ESM，`"type": "module"`）。
- ESLint 配置：`eslint.config.js`，含 React/TS 规则和 hooks 检查。
- Prettier 配置：`prettier.config.cjs`（单引号、分号、100 字符宽度）。
- TS 配置：`tsconfig.json`，ES2022 target，`@/*` 别名指向仓库根目录。
- TS 测试配置：`tsconfig.test.json`（添加 `vitest/globals`，包含测试文件）。
- Vitest 配置：`vitest.config.ts`（jsdom、globals、setup 文件）。
- Vite 配置：`vite.config.ts`（GitHub Pages base、commit 注入、开发代理）。

ESLint 要点：

- `@typescript-eslint/no-unused-vars` 产生警告；使用 `_` 前缀忽略未用参数。
- `@typescript-eslint/consistent-type-imports` 产生警告；优先使用 `import type`。
- `react-refresh/only-export-components` 产生警告；仅允许常量导出。

TypeScript 配置说明：

- `moduleResolution` 为 `bundler`，`module` 为 `ESNext`。
- `allowImportingTsExtensions` 已启用；优先遵循文件中已有的模式。
- `allowJs` 为 true；除非必要，避免引入新的 JS 文件。
- `noEmit` 为 true；构建依赖 Vite/tsc 进行类型检查。

## 代码风格（实际观察与期望）

- 语言：TypeScript + React 19，ES modules。
- 组件使用函数组件与 hooks；保持纯粹和声明式。
- 若代码库规模增长，将相关文件（组件、测试）分组放置；当前使用扁平 `components/` 结构。
- 仅在文件中已有此模式时使用 `React.FC`。
- 优先使用 `const` 而非 `let`，除非需要重新赋值；在提前退出时使用显式 `return`。
- 保持异步流程可读；优先使用 `async/await` 配合 `try/catch` 和明确的回退。
- 避免 JSX 中深层嵌套三元表达式；使用辅助函数或提前返回。
- 统一使用 Tailwind 工具类；保持 class 列表可读并适时换行。
- 避免自定义 CSS，除非绝对必要（如 Tailwind 不支持的复杂动画）。

格式化（Prettier 强制执行）：

- 单引号、分号、尾逗号。
- 2 空格缩进。
- 优先 100 字符行宽；必要时对 JSX props 换行。
- 保持 JSX 属性对齐且可读。

导入：

- 分组顺序：React/内置模块、第三方、内部绝对路径（`@/`）、相对路径。
- 对本地同目录文件使用相对路径（遵循已有文件的做法）。
- 命名导入保持逻辑排序（不一定按字母顺序）。
- 使用 type-only 导入；ESLint 对混合值/类型导入会警告。

类型：

- 将共享类型放在 `types.ts` 中并复用，避免内联 `any`。
- 对对象定义优先使用 `interface` 而非 `type`，除非需要联合/交叉类型。
- 若必须使用 `any`（第三方响应），限制在解析边界内。
- 对导出的异步辅助函数优先使用显式返回类型以提高清晰度。

命名：

- 组件：PascalCase，与文件名一致。
- Hooks：`useXxx`。
- 类型/接口：PascalCase。
- 常量：仅对真正的常量使用 UPPER_SNAKE_CASE（如 API 基础 URL）。
- 局部变量：camelCase。

错误处理：

- API 辅助函数在失败时返回 `null`/`[]` 并记录上下文。
- 仅在调用方必须处理回退时重新抛出（如 `fetchRealTimeQuotes`）。
- 避免对用户可见的后台刷新错误；使用优雅降级。
- 对无效应用状态尽早抛出（如缺失 root 元素）。

## 架构与状态管理

- 状态：使用 React 内置状态（`useState`、`useReducer`、`useContext`）管理 UI 状态。
- 数据库响应式：使用 `dexie-react-hooks`（`useLiveQuery`）对 Dexie 进行响应式查询。
- IndexedDB 通过 `services/db.ts` 中的 Dexie 管理；保持 `initPromise`/`refreshPromise`/`refreshWatchlistPromise` 守卫以避免并发安全问题。
- 服务：将业务逻辑和格式化工具隔离在 `services/` 中。
- 优先使用组件中已有的 session/local storage 模式。

## 测试指引

- 按照 ESLint 配置使用 Vitest 全局变量（`describe`、`it`、`expect`、`vi`）。
- 在组件/服务旁边添加测试。
- 优先通过 `screen` 和语义选择器使用 RTL 查询。
- 保持测试确定性；避免依赖真实网络请求。

## 性能与优化

- 确保 Dexie 查询有索引，防止性能瓶颈。
- 在渲染列表或复杂数据（如 ECharts）时，谨慎使用 `React.memo`、`useMemo` 和 `useCallback`。
- 利用 Vite 的原生优化；避免不必要的重依赖。

## AI 持仓分析开发约定

- 核心逻辑集中在 `services/aiAnalysis.ts`，其中包含提示词生成、上下文压缩、结构化结果解析与缓存 key 逻辑。
- 定期提醒逻辑集中在 `services/aiReminder.ts`，提醒配置持久化到 localStorage；实现时应保持浏览器能力缺失时的优雅降级。
- `components/AiHoldingsAnalysisModal.tsx` 采用常见聊天应用双栏布局：左侧会话列表，右侧聊天与分析区。新增交互优先保持这一布局，不要退回单栏堆叠式信息结构。
- AI 可视化当前使用 ECharts，测试环境（jsdom）不支持 canvas；若新增图表初始化逻辑，必须保留测试环境保护，避免在 jsdom 中直接初始化 canvas 图表。
- 会话导出支持 JSON / Markdown；若继续扩展 PDF 导出，应优先保证 Markdown/JSON 仍然可用，避免单一格式失败导致导出不可用。
- AI 分析缓存应基于持仓快照、问题、模式、provider、model 共同生成 key，避免不同上下文缓存串用。

## I18n

- 使用 `services/i18n.tsx` 中的 `useTranslation().t("common.xxx")`。
- 缺失 key 时返回路径；语言默认为 `zh`，不做持久化。

## 领域规则（关键）

- EastMoney 净值访问必须通过 `services/api.ts` 中的共享队列序列化；仅 `fetchEastMoneyLatestNav` 和 `fetchHistoricalFundNav` 是安全入口，因为它们通过脚本注入读写全局 `window.apidata`。
- EastMoney 脚本注入流程必须在成功和失败时都移除注入的 `<script>` 并重置 `window.apidata`，否则残留数据会污染后续请求。
- 保持 `services/db.ts` 中的 `initPromise`、`refreshPromise` 和 `refreshWatchlistPromise` 守卫，以避免 StrictMode 双重初始化和刷新写入重叠。
- 交易/结算日期必须使用本地 `YYYY-MM-DD` 辅助函数（如 `getLocalDateString`/`getCostDateStr`）而非 UTC `toISOString`，以防止日期边界错误。
- 日收益有意设限：若 `effectivePctDate <= costDateStr`，即使有行情数据，`dayChangePct`/`dayChangeVal` 也必须强制为 0。
- 待处理交易在 `refreshFundData` 内部结算；没有独立的后台结算 worker。
- 盘中估值仅在市场交易且当日无官方净值时运行，使用前十大持仓实时行情。
- `checkIsMarketTrading` 必须优先使用腾讯指数时间戳解析，仅当 API 解析失败时才回退到工作日+09:20。

### QDII/港股/ETF 估值规则

- **基金类型识别**：使用 `identifyFundType` 识别 QDII/港股/ETF 基金，基于代码前缀（如 16xxxx）、名称关键词（如 "QDII"、"港股"）和 fundType 字段。
- **跟踪信息获取**：使用 `fetchFundTrackingInfo` 从东方财富 API 获取基金跟踪的指数或标的，返回 `{ trackingIndex, trackingSymbol }`，其中 `trackingSymbol` 是腾讯财经 API 使用的代码格式（如 "IXIC.GI" 表示纳斯达克指数）。
- **境外行情获取**：使用 `fetchOverseasQuotes` 从腾讯财经 API 获取境外指数/股票实时行情，支持批量查询，返回包含 `symbol`、`name`、`price`、`change`、`changePct`、`updateTime` 的数组。
- **时区处理**：境外市场交易时间判断需考虑时区差异，使用 `checkIsOverseasMarketTrading` 判断美股（美东时间 09:30-16:00）、港股（香港时间 09:30-16:00）等市场是否在交易时间内。
- **估值计算**：QDII/港股/ETF 基金的日内估值基于跟踪指数的涨跌幅，公式为 `estimatedNav = lastNav * (1 + trackingIndexChangePct)`，仅在对应市场交易时间内计算。
- **API 限制**：腾讯财经 API 有频率限制，`fetchOverseasQuotes` 内置请求队列管理，避免并发请求过多触发限流。
- **数据延迟**：境外行情数据可能有 15 分钟延迟，`updateTime` 字段标识行情更新时间，需在 UI 中提示用户。
- **错误处理**：如果跟踪信息获取失败或行情接口返回空数据，应优雅降级，不显示估值而非报错，避免影响其他基金的正常显示。

### 使用示例

```typescript
// 识别基金类型
const fundType = identifyFundType(fundCode, fundName, fundTypeField);
if (fundType === 'QDII' || fundType === 'HK' || fundType === 'ETF') {
  // 获取跟踪信息
  const trackingInfo = await fetchFundTrackingInfo(fundCode);
  if (trackingInfo?.trackingSymbol) {
    // 检查市场交易时间
    const isTrading = checkIsOverseasMarketTrading(trackingInfo.trackingSymbol);
    if (isTrading) {
      // 获取实时行情
      const quotes = await fetchOverseasQuotes([trackingInfo.trackingSymbol]);
      if (quotes.length > 0) {
        const quote = quotes[0];
        // 计算估值
        const estimatedNav = lastNav * (1 + quote.changePct / 100);
      }
    }
  }
}
```

## PWA 与安全区域适配

- 部署站点 `https://gp.hrfuqiang.top/fund-manager/`，`index.html` 中配置了 `viewport-fit=cover`、`apple-mobile-web-app-capable`、`apple-mobile-web-app-status-bar-style`（`black-translucent`）和 `theme-color`（对应浅色/深色）。
- `public/manifest.json` 配置 PWA 为 `standalone` 模式，`start_url` 为 `/fund-manager/`。
- **灵动岛适配核心模式**：用 CSS `max()` 结合 `env(safe-area-inset-*)` 确保普通设备有最小间距、灵动岛设备追加系统安全区。
  - 顶部间距：`paddingTop: max(3.5rem, env(safe-area-inset-top, 0px))`（移动端至少 Header 高度）
  - 底部间距：`pb-[env(safe-area-inset-bottom,16px)]`（回退 16px）
  - Tailwind 任意值语法支持 `env()` 但不支持嵌套 `max()`，复杂表达式需用内联 `style` 属性
- Header 当前使用 `sticky top-0` + 负 `marginTop` 方案适配灵动岛；不要改回 `fixed` 或重新添加 `isolation:isolate`。
- `.glass-nav` 是 Header 和 BottomNav 的共享类，**不要在 `.glass-nav` 中添加 `padding-top: env(safe-area-inset-top)`**——那会对底栏产生副作用（向上扩展遮挡 Ticker）。

## ErrorBoundary

- `components/ErrorBoundary.tsx`：React class component，捕获子组件渲染错误，显示错误回退 UI（含重试按钮，匹配亮色/暗色主题）。
- `index.tsx` 中用 `<ErrorBoundary>` 包裹 `<App />`，root 缺失时在 body 内渲染错误提示而非 `throw`。
- 任何未捕获异常都会触发 ErrorBoundary，防止 React 18 卸载整个组件树导致白屏。
- 新增组件或复杂逻辑时应考虑边界情况，但不需要额外包裹 ErrorBoundary（顶层已处理）。

## Modal Shell

- 所有 Modal 必须使用 `ModalShell` 统一封装开关动画、backdrop、overlay 注册。
- ModalShell 使用 framer-motion (`AnimatePresence` + `motion.div`) 提供入场/退场动画。
- 支持 `edgeSwipe` prop 启用边缘滑动手势关闭；ModalShell 内部处理 `closeTargetX`、`requestClose`、overlay 注册。
- Modal 只需传入 `isOpen`、`onClose`、`overlayId` 和 `children`，不自行管理动画态或 overlay 注册。
- 可选 prop：`className`（卡片样式）、`zIndex`（层级）、`onExitComplete`（退出完成回调）。
- 测试中需 `vi.mock('framer-motion', ...)` 将 `AnimatePresence` 设为直通组件、`motion.div` 设为普通 `div`。

## Vite/运行时假设

- Vite base 为 `/fund-manager/`（GitHub Pages），部署站点为 `https://gp.hrfuqiang.top/fund-manager/`。
- 开发服务器运行在 3000 端口，绑定到 `0.0.0.0`。
- 蛋卷请求依赖开发代理 `/djapi` 并强制带 `Referer` 头。
- Vite 配置将最近 5 条 commit 注入 `import.meta.env.VITE_COMMITS_JSON`。
- Commit subject 翻译使用 Gemini (`GEMINI_API_KEY`)，自动回退到 DeepSeek (`DEEPSEEK_API_KEY`)。两者均不可用时跳过翻译，不使构建失败。
- `WelcomeModal` 使用 `VITE_LATEST_COMMIT_HASH` + `localStorage.lastSeenVersion`，忽略格式错误的 commit JSON。
- **Lightning CSS 去重陷阱**：Tailwind v4 的 Lightning CSS 会对源码中值相同的 `backdrop-filter` 与 `-webkit-backdrop-filter` 做语义级去重（解析 CSS 变量和 `calc()` 后比较），构建后仅保留 webkit 前缀版本，导致 Chromium 桌面端静默失效。**解法**：将 unprefixed 版本放入 `@supports (backdrop-filter: blur(1px))` 块内，利用 CSS 作用域隔离阻止跨块去重。主规则保留字面值 webkit 版本，`@supports` 块内通过 `var()` 引用 CSS 变量；Lightning CSS 会在 `@supports` 块内自动补全两种前缀且不去重。

## FundDetail 图表领域规则

- **累计收益图表**使用 `Data_ACWorthTrend`（而非 `Data_netWorthTrend`）以包含分红调整收益。
- **时间范围重基**：切换 1M/3M/6M/1Y/3Y/5Y/ALL 时，使用 `(value / baseValue - 1) * 100` 将基金和基准线在时段起点重基为 0。
- **红绿颜色分段**：正收益段以红色（`#f87171`）渲染，负收益段以绿色（`#34d399`）渲染，通过单条连续 series 中逐点 `itemStyle.color` 实现。
- **零轴插值**：当数据穿越 0 轴时，在正负 area series 中各插入一个插值锚点以保持视觉连续性。
- **基准插值**：基准数据在零轴交叉索引处接收匹配的插值点以保持对齐。
- 图表配置集中在 `components/fundDetailChartUtils.ts`（`buildChartOption`、`buildFundSeries`、`buildAreaSeries`）。
- 交易标记（买入/卖出/清仓/锚点）通过 `markPoint` 渲染；锚点日期在 y=0 处显示虚线 `markLine`。

## Dashboard 领域规则

- **已清仓组**分隔条使用水晶翡翠绿渐变（`linear-gradient` + `inset box-shadow`）将活跃持仓与已清仓持仓视觉分离。
- 已清仓基金默认折叠；分隔条显示基金数量并作为折叠/展开开关。

## 数据与日期处理

- 始终优先使用本地日期辅助函数进行交易/结算逻辑。
- 不使用 UTC 转换，避免跨日期边界偏移。
- 日收益由 `effectivePctDate` 驱动，在成本日期之前为零。
- 待处理交易仅在 `refreshFundData` 刷新期间结算。

## Git 规范

- 编写清晰、简洁、描述性的 commit message；遵循 Conventional Commits（`<type>(<scope>): <subject>`）。
- 不提交 `.env` 文件、构建产物（`dist/`）或本地缓存。确保它们在 `.gitignore` 中。

## 完成前检查清单

- 运行 `npm run lint` 确认无 lint 错误。
- 运行 `npm run test` 确认所有测试通过。
