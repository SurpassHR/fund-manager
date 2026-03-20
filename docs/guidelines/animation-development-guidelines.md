# 组件动画开发规范（必遵循）

> 目的：统一新增组件动画实现方式，确保动画与业务逻辑解耦、可维护、可回归。

## 1. 总原则

1. **动画与业务分离**
   - 业务组件只表达“切换哪个视图/状态”，不直接维护动画细节。
   - 禁止在业务组件中散落硬编码动画参数（如 `duration`、`ease`、`stiffness`、`damping`）。

2. **统一动画入口**
   - 视图切换必须优先使用：`components/transitions/AnimatedSwitcher.tsx`。
   - 动画参数必须集中在：`services/animations/presets.ts`。

3. **可访问性优先**
   - 必须支持 `prefers-reduced-motion`。
   - reduced motion 下应降级为无位移或极短透明度过渡，避免强动画刺激。

4. **视觉语义一致**
   - 同类交互使用同类动画预设（页面级、局部级、导航级）。
   - hover 与 active 的形状和层级需统一，语义颜色区分明确（例如：hover 中性、active 强调色）。

---

## 2. 现有动画基础设施（必须复用）

### 2.1 AnimatedSwitcher

文件：`components/transitions/AnimatedSwitcher.tsx`

推荐用法：

- `viewKey`: 必填，当前视图唯一键
- `preset`: 动画预设名（来自 `presets.ts`）
- `mode`: `sync | wait | popLayout`
- `enableExit`: 是否启用退出动画

使用规则：

- **页面级切换**（如 tab、子页面）：优先 `mode="wait"`，避免并行动画末尾闪切。
- **局部内容切换**：默认 `mode="sync"`，如出现闪切再评估是否改为 `wait`。
- 测试/弹层场景若退出残影影响用例稳定性，可局部 `enableExit={false}`。

### 2.2 presets 动画配置

文件：`services/animations/presets.ts`

当前已定义：

- `pageFadeLift`
- `sectionFadeLift`
- `getBottomNavAnimation(...)`

新增动画时必须：

1. 先在 `presets.ts` 增加配置
2. 由组件按“预设名称/配置对象”引用
3. 禁止在组件内重复写同类参数

---

## 3. 新增组件动画开发流程（标准流程）

1. **定义场景类型**
   - 页面切换 / 局部切换 / 导航状态 / 弹层进出。

2. **选择或新增预设**
   - 能复用现有预设就不新增。
   - 必要新增时在 `presets.ts` 完成，包含 reduced motion 分支。

3. **组件接入**
   - 视图切换优先 `AnimatedSwitcher`。
   - 状态动画（如导航指示器）从配置层读取参数。

4. **验证回归**
   - 单测：关键动画状态的 DOM 行为可被断言（如 active 指示器唯一、切换后归位）。
   - 构建：`npm run build`
   - 测试：按影响范围执行组件测试与全量测试
   - Lint：不引入新的 error

---

## 4. 禁止事项（红线）

1. 在业务组件直接散落硬编码动效参数。
2. 动画改动与业务逻辑改动强耦合（一次修改难以拆分）。
3. 无 reduced motion 支持。
4. 未验证就提交（至少需完成受影响组件测试 + build）。

---

## 5. 验收清单（PR 自检）

- [ ] 动画参数来自 `services/animations/presets.ts`
- [ ] 视图切换使用 `AnimatedSwitcher`
- [ ] 支持 `prefers-reduced-motion`
- [ ] 未引入新的测试失败类型
- [ ] `npm run build` 通过
- [ ] 无新增 lint error

---

## 6. 适用范围

本规范适用于本仓库内所有新增组件动画与现有组件动画改造。后续默认按此规范执行，除非有明确例外说明。
