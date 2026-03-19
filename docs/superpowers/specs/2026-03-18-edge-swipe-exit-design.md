# 边缘滑动退出（移动端）— 设计规格

## 概述

新增移动端边缘滑动手势，用于关闭当前最上层的覆盖层（弹窗或详情页）。
页面随手指移动，松手时根据是否超过屏幕宽度一半来决定回弹或关闭。

## 目标

- 左/右边缘向内滑动关闭最上层覆盖层。
- 可撤回的手势交互：未达到阈值回弹，达到阈值滑出关闭。
- 覆盖层统一行为，减少分散逻辑。

## 非目标

- 通过滑动切换 Tab 或路由。
- 组件内部的自定义手势逻辑。

## 交互行为

- 起手区域：手指起点必须在屏幕左/右边缘 20px 内。
- 滑动方向必须向内：
  - 左边缘起手：要求 `dx > 0`。
  - 右边缘起手：要求 `dx < 0`。
- 仅识别水平滑动：`|dx| > 2 * |dy|`。
- 拖动过程中，覆盖层沿 X 轴跟随 `dx` 位移。
- 松手判定：
  - `|dx| < 0.5 * screenWidth` → 回弹到 `x = 0`（取消）。
  - `|dx| >= 0.5 * screenWidth` → 滑出屏幕并关闭。
    - 滑出目标：`translateX = sign(dx) * screenWidth`。
- `screenWidth` 取视觉视口宽度：`window.visualViewport?.width ?? window.innerWidth`，
  在旋转/尺寸变化时刷新。
- 若在拖动过程中发生旋转/尺寸变化，直接取消当前手势并回弹重置。
- 仅最上层覆盖层响应。
- 无覆盖层时不处理手势。

## 架构

### 覆盖层栈管理器

新增一个轻量的覆盖层栈管理模块，用于统一开关和层级。

导出接口：

- `registerOverlay(id, requestClose)`
- `unregisterOverlay(id)`
- `closeTopOverlay(payload?)`
- `getActiveOverlayId()`

实现说明：

- 以栈结构保存 `{ id, requestClose }`。
- `closeTopOverlay(payload?)` 调用栈顶 `requestClose(payload)`。
- 覆盖层在打开时注册，关闭/卸载时注销。
- 若同一覆盖层重新注册（重开），更新条目并置于栈顶。
- 若多个覆盖层在同一渲染周期打开，注册顺序以 `useEffect` 触发顺序为准，
  栈顶为最后注册的覆盖层。

覆盖层 ID：

- 使用稳定的显式 ID（如 `fund-detail`、`add-fund-modal`）。
- 多实例加后缀（如 `fund-detail:${fundId}`）。

关闭契约：

- `requestClose: (payload?: { source?: 'edge-swipe' | 'programmatic'; targetX?: number }) => void`
  触发覆盖层关闭动画并最终卸载（通过其原有 `onClose`）。
- `targetX` 用于边缘滑动关闭时的滑出目标位置。
- 手势层不等待结果，仅发起关闭。
- 覆盖层在 `requestClose` 中解析 `payload`，当 `source === 'edge-swipe'` 且
  `targetX` 存在时，设置本地 `closeTargetX` 并启动关闭动画。

### 全局手势监听

在 `App.tsx` 中注册全局监听，统一绑定到 `document`，
确保覆盖通过 portal（渲染到 `document.body`）的弹窗也能被捕获：

- 优先使用 pointer 事件（`pointerdown/move/up`），并限制 `pointerType === 'touch'`。
- 不支持 pointer 时回退到 `touchstart/move/end`。
- pointer 路径仅处理 `isPrimary === true`；touch 路径要求 `touches.length === 1`。
- 识别边缘起手并跟踪 `dx/dy`。
- pointer 方案：不设置全局 `touch-action`，避免影响应用内水平滚动；
  不调用 `preventDefault()`，仅在确认水平意图后启用拖动逻辑。
- touch 回退方案：`touchmove` 监听一开始就使用 `{ passive: false }`，只在确认
  水平意图后调用 `preventDefault()`，避免打断正常滚动。
- 处理 `pointercancel`/`touchcancel`，重置拖动并回弹。
- 手势激活后进行指针捕获（如支持），结束/取消或覆盖层关闭时释放。
- 指针捕获需在事件目标元素上调用 `setPointerCapture`，监听绑定到 `document`
  时，使用 `event.target`（若为 `HTMLElement`）进行捕获；不可捕获时不强制。

## 集成点

需注册的覆盖层：

- `FundDetail`
- `ScannerModal`
- `WelcomeModal`
- `AddFundModal`
- `AdjustPositionModal`
- `TransactionHistoryModal`
- `AddWatchlistModal`
- 任何新增的弹窗/详情覆盖层（有 `onClose` 的）

注册原则：仅在 `isOpen`/可见时注册。

注册辅助：

- 提供 `useOverlayRegistration(id, isOpen, requestClose)` 统一注册时机。
- 在 `useEffect` 中，当 `isOpen` 为 true 注册，cleanup 或 `isOpen` 变 false 时注销。

## 拖动渲染

- 在应用根部提供拖动状态上下文，如：
  `{ isDragging, dragX, edge, activeOverlayId, closeTargetX, setDragState }`。
- 全局手势监听负责写入拖动状态（`setDragState`），覆盖层只读取并渲染。
- 仅当 `id === activeOverlayId` 时应用拖动 transform。
- transform 应用于覆盖层内容根节点（不影响遮罩层）。
- 拖动过程只在激活期间生效。
- 松手后：
  - 覆盖层负责动画：以当前 `dragX` 为起点，过渡到 `targetX`，结束后调用 `onClose`。
  - 手势层设置 `closeTargetX` 并调用 `requestClose({ source: 'edge-swipe', targetX })`。
- `dragX` 需要 clamp 到 `[-screenWidth, screenWidth]`，避免过度拖动。

遮罩行为：

- 遮罩层保持固定，只有内容层位移。

## 边界与安全

- 忽略多指触控。
- iOS Safari 左边缘系统返回手势可能优先触发；此类场景以系统行为为准，
  我们的边缘滑动属于“尽力而为”。
- 忽略起手于 `input/textarea/select/contenteditable` 或带 `data-no-edge-swipe` 的元素。
- 若从可水平滚动容器起手，则取消边缘滑动：
  - 从事件目标向上查找，若祖先元素 `overflow-x` 为 `auto|scroll` 且
    `scrollWidth > clientWidth`，则认为可水平滚动并取消。
- 若手势转为纵向（不满足 `dx/dy` 比例），取消追踪。
- 覆盖层中途关闭时重置拖动状态，避免残留 transform。
- 拖动状态由全局手势监听在 `end/cancel` 时清空；若覆盖层卸载导致关闭，
  也应清空 `dragX/closeTargetX/activeOverlayId`。

## 测试策略

- 覆盖层栈管理器：注册/注销顺序、栈顶关闭。
- 代表性覆盖层：打开时注册、关闭时注销。
- 手势逻辑（可选）：阈值、方向、轴向过滤的事件测试。

## 验收标准

- 左右边缘向内滑动只关闭最上层覆盖层。
- 拖动可撤回：位移 < 50% 回弹，≥ 50% 关闭。
- 左右边缘均可触发，且不影响垂直滚动。
