# 清仓基金折叠组功能设计

## 概述

本设计文档描述了在持仓列表中添加清仓基金折叠组的功能,以便用户可以查看和管理已清仓的基金,同时保证持有收益计算的正确性。

## 背景

当前实现中,清仓基金(份额为 0 的基金)会被直接过滤掉,不在持仓列表中显示。这导致:

1. 用户无法查看清仓基金的历史交易记录
2. 如果用户想再次买入同一基金,需要重新添加,丢失历史数据
3. 总收益计算可能不准确(虽然当前实现已正确处理)

## 目标

1. 在持仓列表末尾显示清仓基金组,默认折叠
2. 用户可以点击展开查看所有清仓基金
3. 清仓基金支持与活跃基金相同的操作(查看详情、加仓、查看交易历史等)
4. 清仓基金的交易历史完整保留,确保收益计算正确
5. 清仓基金再次买入后自动回到活跃列表

## 设计方案

### 1. 架构设计

#### 1.1 组件状态扩展

在 `Dashboard.tsx` 中添加以下状态:

```typescript
const CLEARED_GROUP_STORAGE_KEY = 'dashboard.clearedGroupExpanded';

const [isClearedGroupExpanded, setIsClearedGroupExpanded] = useState<boolean>(() => {
  try {
    const stored = localStorage.getItem(CLEARED_GROUP_STORAGE_KEY);
    return stored ? JSON.parse(stored) : false;
  } catch {
    return false;
  }
});
```

#### 1.2 基金列表分组逻辑

将 `filteredFunds` 分为两组:

```typescript
const activeFunds = useMemo(
  () => sortedFunds.filter((fund) => fund.holdingShares > 0),
  [sortedFunds],
);

const clearedFunds = useMemo(
  () => sortedFunds.filter((fund) => fund.holdingShares === 0),
  [sortedFunds],
);
```

#### 1.3 渲染结构

```
持仓列表
├── 活跃基金卡片 (activeFunds)
├── 清仓组汇总卡片 (如果 clearedFunds.length > 0)
└── 清仓基金卡片列表 (如果展开且 clearedFunds.length > 0)
```

### 2. UI 组件设计

#### 2.1 清仓组汇总卡片

**视觉设计**:

- 背景色: 使用主题中的次要背景色(与普通基金卡片区分)
- 布局: 左侧显示图标和文字,右侧显示展开/折叠箭头
- 文字: "已清仓 (N)" - N 为清仓基金数量
- 图标: 使用 `Icons.ChevronDown` (折叠时) / `Icons.ChevronUp` (展开时)

**交互行为**:

- 点击整个卡片切换展开/折叠状态
- 状态变化时保存到 localStorage
- 支持长按显示上下文菜单(可选功能,如"全部删除清仓基金")

**实现示例**:

```tsx
{
  clearedFunds.length > 0 && (
    <div
      className="cleared-group-summary"
      onClick={() => {
        const nextExpanded = !isClearedGroupExpanded;
        setIsClearedGroupExpanded(nextExpanded);
        localStorage.setItem(CLEARED_GROUP_STORAGE_KEY, JSON.stringify(nextExpanded));
      }}
    >
      <div className="cleared-group-summary-left">
        <Icons.Archive className="cleared-group-icon" />
        <span>{t('common.clearedFundsCount', { count: clearedFunds.length })}</span>
      </div>
      <div className="cleared-group-summary-right">
        {isClearedGroupExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
      </div>
    </div>
  );
}
```

#### 2.2 清仓基金卡片

**视觉设计**:

- 与活跃基金卡片保持一致的样式
- 可选: 添加轻微的视觉标识(如左侧边框颜色不同)表示这是清仓基金

**交互行为**:

- 点击: 打开基金详情页(与活跃基金一致)
- 长按: 显示上下文菜单,包含:
  - 加仓
  - 查看交易历史
  - 删除(从数据库永久删除)

**实现示例**:

```tsx
<AnimatePresence>
  {isClearedGroupExpanded && clearedFunds.length > 0 && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {clearedFunds.map((fund) => (
        <FundCard
          key={fund.id}
          fund={fund}
          isCleared={true}
          onClick={() => handleFundClick(fund)}
          onLongPress={() => handleFundLongPress(fund)}
        />
      ))}
    </motion.div>
  )}
</AnimatePresence>
```

#### 2.3 动画效果

- 展开/折叠使用平滑的高度过渡动画
- 使用 framer-motion 的 `AnimatePresence` 实现
- 动画时长: 200ms
- 缓动函数: ease

### 3. 数据处理与边界情况

#### 3.1 收益计算保证

**关键点**: 清仓基金的交易历史必须完整保留,以确保:

1. 用户可以查看完整的交易记录
2. 再次买入时,成本价计算基于历史交易
3. 总收益统计包含清仓基金的历史收益

**实现**:

- 清仓基金不从数据库删除,只是 UI 上分组显示
- `calculateSummary` 函数已经正确处理 `holdingShares === 0` 的情况(不计入当前持仓,但历史交易保留)

#### 3.2 边界情况处理

1. **无清仓基金**: 不显示清仓组汇总卡片
2. **清仓基金再次买入**:
   - `holdingShares` 变为正数后,自动从清仓组移到活跃列表
   - 无需额外代码,依赖现有的响应式数据流
3. **筛选器交互**:
   - 清仓组只显示当前筛选器下的清仓基金
   - 如果筛选后无清仓基金,不显示清仓组
4. **排序交互**:
   - 清仓基金也参与排序(在清仓组内部排序)
   - 清仓组汇总卡片位置固定在活跃基金列表末尾

### 4. 国际化

需要在 `services/i18n.tsx` 中添加以下翻译键:

```typescript
// 中文
common: {
  // ... 现有翻译
  clearedFundsGroup: '已清仓',
  clearedFundsCount: '已清仓 ({count})',
  expandClearedFunds: '展开清仓基金',
  collapseClearedFunds: '收起清仓基金',
}

// 英文
common: {
  // ... existing translations
  clearedFundsGroup: 'Cleared',
  clearedFundsCount: 'Cleared ({count})',
  expandClearedFunds: 'Expand cleared funds',
  collapseClearedFunds: 'Collapse cleared funds',
}
```

### 5. 测试策略

#### 5.1 单元测试 (`Dashboard.clearedFunds.test.tsx`)

1. **测试清仓基金正确分组**

   ```typescript
   it('separates active and cleared funds correctly', () => {
     const funds = [
       { id: 1, holdingShares: 100, ... },
       { id: 2, holdingShares: 0, ... },
       { id: 3, holdingShares: 50, ... },
     ];
     // 验证 activeFunds 包含 id 1 和 3
     // 验证 clearedFunds 包含 id 2
   });
   ```

2. **测试展开/折叠状态切换**

   ```typescript
   it('toggles cleared group expansion on click', () => {
     // 点击清仓组汇总卡片
     // 验证状态从 false 变为 true
     // 验证清仓基金列表显示
   });
   ```

3. **测试 localStorage 持久化**

   ```typescript
   it('persists expansion state to localStorage', () => {
     // 展开清仓组
     // 验证 localStorage 中保存了 true
     // 刷新组件
     // 验证清仓组保持展开状态
   });
   ```

4. **测试清仓基金再次买入后自动移到活跃列表**

   ```typescript
   it('moves cleared fund to active list after buy', async () => {
     // 创建一个清仓基金
     // 执行加仓操作
     // 验证基金从 clearedFunds 移到 activeFunds
   });
   ```

5. **测试筛选器对清仓组的影响**
   ```typescript
   it('filters cleared funds by account', () => {
     // 设置筛选器为特定账户
     // 验证清仓组只显示该账户的清仓基金
   });
   ```

#### 5.2 集成测试

1. **测试清仓基金的完整交互流程**
   - 清仓一个基金
   - 展开清仓组
   - 点击清仓基金查看详情
   - 执行加仓操作
   - 验证基金回到活跃列表

2. **测试清仓基金的上下文菜单功能**
   - 长按清仓基金
   - 验证上下文菜单显示
   - 测试各个菜单项功能

3. **测试清仓基金详情页的正常显示**
   - 打开清仓基金详情页
   - 验证历史交易记录完整显示
   - 验证图表正确渲染

### 6. 性能考虑

1. **使用 `useMemo` 缓存分组结果**

   ```typescript
   const activeFunds = useMemo(
     () => sortedFunds.filter((fund) => fund.holdingShares > 0),
     [sortedFunds],
   );
   ```

2. **清仓基金列表使用条件渲染**
   - 折叠时不渲染 DOM,避免不必要的渲染开销

3. **展开/折叠动画使用 CSS transform**
   - 避免触发 layout,提高动画性能

## 实现步骤

1. **修改 Dashboard 组件**
   - 添加 `isClearedGroupExpanded` 状态
   - 添加 `activeFunds` 和 `clearedFunds` 分组逻辑
   - 移除现有的 `if (fund.holdingShares === 0) return null` 过滤逻辑

2. **添加清仓组汇总卡片组件**
   - 创建 `ClearedGroupSummary` 组件
   - 实现点击切换展开/折叠
   - 实现 localStorage 持久化

3. **修改基金卡片渲染逻辑**
   - 先渲染活跃基金列表
   - 然后渲染清仓组汇总卡片
   - 最后渲染清仓基金列表(如果展开)

4. **添加国际化文本**
   - 在 `services/i18n.tsx` 中添加翻译键

5. **编写测试**
   - 创建 `Dashboard.clearedFunds.test.tsx`
   - 实现单元测试和集成测试

6. **样式调整**
   - 添加清仓组汇总卡片的样式
   - 可选: 为清仓基金卡片添加视觉标识

## 风险与缓解

### 风险 1: 清仓基金过多导致性能问题

**缓解措施**:

- 使用 `useMemo` 缓存分组结果
- 折叠时不渲染清仓基金列表
- 如果未来确实出现性能问题,可以升级到虚拟滚动方案

### 风险 2: 清仓基金的交易历史可能丢失

**缓解措施**:

- 清仓基金不从数据库删除,只是 UI 上分组显示
- 添加测试确保交易历史完整保留
- 在用户手动删除清仓基金时显示确认对话框

### 风险 3: 用户可能不理解清仓组的概念

**缓解措施**:

- 使用清晰的文案("已清仓")
- 添加图标提示
- 可选: 在首次使用时显示引导提示

## 成功标准

1. 清仓基金正确显示在持仓列表末尾
2. 用户可以点击展开/折叠清仓组
3. 清仓基金支持与活跃基金相同的操作
4. 清仓基金的交易历史完整保留
5. 清仓基金再次买入后自动回到活跃列表
6. 所有测试通过
7. 无性能回归

## 未来扩展

1. **批量操作**: 支持批量删除清仓基金
2. **自动清理**: 可选的自动清理策略(如 30 天后自动删除)
3. **统计信息**: 在清仓组汇总卡片中显示清仓基金的总收益统计
4. **搜索功能**: 支持在清仓基金中搜索
