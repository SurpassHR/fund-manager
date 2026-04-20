# Modal 行为层 Hook 抽象 — 设计规格

## 概述

将现有各个 modal 中重复出现的“行为层逻辑”抽出为统一 Hook，先收敛以下共性：

- 页面滚动锁（禁止 modal 打开时滚动底层页面）
- overlay 栈注册与注销
- `Escape` 快捷关闭
- 统一的 `requestClose(payload?)` 入口

本次抽象**不**处理视觉结构、Framer Motion 动画、边缘滑动位移状态、backdrop JSX。

## 目标

- 提供一个轻量、低侵入的 `useModalOverlay` Hook。
- 让后续新增 modal 默认继承一致的基础关闭行为。
- 减少各 modal 内重复的 `handleClose` / `requestClose` / `Escape` 监听样板代码。
- 避免再次出现某个 modal 漏接滚动锁或 overlay 注册的问题。

## 非目标

- 不抽象 `BaseModal` / `ModalShell`。
- 不统一各 modal 的动画实现。
- 不接管 `closeTargetX`、`snapBackX`、`transition` 等边缘滑动渲染状态。
- 不在本阶段重写所有历史 modal，只优先改造典型覆盖层。

## 背景问题

当前仓库中的 modal 已部分接入 `useOverlayRegistration`，但接入不完全：

- `AdjustPositionModal`、`TransactionHistoryModal`、`AddFundModal` 等已有 overlay 注册模式。
- `RebalanceModal` 曾遗漏注册，导致滚轮滚动穿透到底层页面。

问题的根因不是某个样式类缺失，而是行为逻辑分散在多个 modal 内，靠人工复制粘贴，容易漏掉。

## 推荐方案

新增：`services/useModalOverlay.ts`

建议接口：

```ts
const { requestClose } = useModalOverlay({
  id: 'rebalance-modal',
  isOpen,
  onClose,
  closeOnEscape: true,
});
```

返回值暂时只暴露：

- `requestClose(payload?)`

其中：

```ts
type ClosePayload = {
  source?: 'edge-swipe' | 'programmatic';
  targetX?: number;
};
```

## Hook 职责

### 1. 页面滚动锁

- 当 `isOpen === true` 时锁定 `document.body.style.overflow` 与
  `document.documentElement.style.overflow`。
- 当关闭或卸载时恢复之前值。
- 必须支持多个 overlay 并存，因此内部应继续使用计数器或等价机制，保证：
  - 第一个 overlay 打开时加锁
  - 最后一个 overlay 关闭时解锁

### 2. Overlay 注册

- 内部复用现有 `useOverlayRegistration`。
- 统一在 `isOpen === true` 时注册，在关闭或卸载时注销。
- `requestClose(payload?)` 作为 overlay stack 的关闭回调。

### 3. Escape 关闭

- 当 `isOpen === true` 且 `closeOnEscape !== false` 时监听 `keydown`。
- 按下 `Escape` 时调用 `requestClose({ source: 'programmatic' })`。
- 关闭或卸载时移除监听。

### 4. 统一关闭协议

- Hook 不直接处理动画。
- Hook 内部维护统一的关闭入口：

```ts
requestClose(payload?)
```

- 默认行为：直接调用传入的 `onClose()`。
- `payload` **不会**透传给 `onClose`。它的作用仅限于：
  - 让 overlay stack / `Escape` / backdrop 点击共用同一个关闭入口
  - 让 modal 自己的本地包装逻辑有机会识别关闭来源（尤其是 edge-swipe）
- 调用方如需处理边缘滑动动画，可在外层包一层：

```ts
const { requestClose } = useModalOverlay({
  id,
  isOpen,
  onClose: () => {
    if (closeTargetXRef.current != null) {
      // modal 自己处理动画收尾
      return;
    }
    rawOnClose();
  },
});
```

更推荐的用法是：业务组件自己保留一层本地 `requestClose`，但底层关闭协议由 Hook 统一提供。

### 5. Edge-swipe 判定约定

- 对于依赖边缘滑动关闭动画的 modal，应以以下条件识别滑动关闭：

```ts
payload?.source === 'edge-swipe' && payload.targetX !== undefined
```

- 不建议只判断 `targetX` 是否存在，因为现有仓库里 `WelcomeModal` 已明确依赖
  `source === 'edge-swipe'` 语义。
- 这样可以保证各 modal 对关闭来源的判定一致，避免后续出现行为分叉。

## 建议 API

```ts
interface UseModalOverlayOptions {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
}

interface UseModalOverlayResult {
  requestClose: (payload?: ClosePayload) => void;
}
```

说明：

- `closeOnEscape` 默认 `true`
- 暂不添加 `closeOnBackdrop`，因为 backdrop 点击行为仍在 JSX 层，由各 modal 自行决定

## 集成方式

### 当前推荐改造对象

第一批接入：

- `RebalanceModal`
- `AdjustPositionModal`
- `TransactionHistoryModal`
- `AddFundModal`
- `AddWatchlistModal`

特殊形态，需单独适配后再接入：

- `ScannerModal`：使用的是 `overlayOpen = isOpen || isReviewing`，不是简单的 `isOpen` 直传
- `WelcomeModal`：内部持有 `isOpen` / `isVisible` / 延时关闭收尾，不是标准的外部受控 modal

第二批按需补齐：

- `AccountManagerModal`
- 其他新增覆盖层组件

### modal 内部改造前后对比

改造前常见重复逻辑：

- `handleClose = useCallback(() => onClose(), [onClose])`
- `requestClose(payload?)`
- `useOverlayRegistration(...)`
- `useEffect` 监听 `Escape`

改造后：

- 只保留业务需要的关闭前状态处理
- 通用行为交给 `useModalOverlay`

示意：

```ts
const handleClose = useCallback(() => {
  onClose();
}, [onClose]);

const { requestClose } = useModalOverlay({
  id: 'transaction-history-modal',
  isOpen,
  onClose: handleClose,
});
```

如果某 modal 存在 `closeTargetX` 之类的特殊逻辑，则保留本地包装：

```ts
const { requestClose: baseRequestClose } = useModalOverlay({
  id,
  isOpen,
  onClose: handleClose,
});

const requestClose = useCallback((payload?: ClosePayload) => {
  if (payload?.source === 'edge-swipe' && payload.targetX !== undefined) {
    setCloseTargetX(payload.targetX);
    return;
  }
  baseRequestClose(payload);
}, [baseRequestClose]);
```

### 例外说明

- 不是所有“看起来像 modal”的组件都能立刻套入统一模板。
- 只要组件满足“外部传入 `isOpen` 和 `onClose`”的基本受控模型，就可以优先接入。
- 若组件存在内部开关、复合可见条件、延时卸载、多阶段视图（如扫描预览态），则需要在接入时单独判断：
  - 传给 Hook 的打开条件是什么
  - `requestClose` 应该关闭哪一层状态
  - 是否仍保留组件自身的动画收尾逻辑

## 设计取舍

### 为什么现在只抽 Hook

- 当前各 modal 的结构、动画、关闭方式不完全一致。
- 如果直接上 `ModalShell`，会把“行为统一”和“视觉统一”耦合到一次改造里，风险更高。
- 只抽 Hook 能先解决一致性问题，同时保留现有 JSX 与动画差异。

### 为什么不把 edge-swipe 状态也收进 Hook

- `closeTargetX`、`snapBackX`、`transform`、`onTransitionEnd` 与不同组件的动画结构耦合很深。
- 现在强行收口，会导致 Hook 过大、职责混乱。
- 更适合作为下一阶段抽象，而不是这次行为层修复的一部分。

## 测试策略

### Hook 层测试

新增或扩展服务层测试，验证：

- 打开时锁定 body/html 滚动
- 关闭时恢复滚动
- 多 overlay 并存时仅在最后一个关闭后解锁
- `Escape` 能触发关闭
- overlay stack 仍能正确关闭栈顶覆盖层

### 组件回归测试

至少为代表性 modal 增加用例：

- `RebalanceModal` 打开时锁定滚动
- 现有已接入 modal 行为不回退

## 验收标准

- 新增 `useModalOverlay` 后，第一批接入 modal 不再各自手写重复的 overlay 行为代码。
- 任一接入该 Hook 的 modal 打开时，底层页面不会因鼠标滚轮而滚动。
- 多个 modal 叠加时，滚动锁不会提前释放。
- `Escape` 关闭行为在接入 modal 中保持一致。
- 现有 edge-swipe 与关闭动画不被破坏。

## 后续演进

如果这次 Hook 抽象稳定，再考虑下一阶段：

1. 抽 `ModalShell`
2. 统一 backdrop / 布局容器 / 关闭按钮位
3. 再评估是否抽离 edge-swipe 动画状态
