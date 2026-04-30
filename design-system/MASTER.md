# CosmeticBox 设计系统 — Master

> 全局设计规范，所有页面遵循此文件。页面级覆盖见 `pages/<page-name>.md`。

## 设计理念

三个核心支柱：

1. **极简几何**（Monument Valley）— 纯净、有序、呼吸感，用圆、三角、方作为装饰语言
2. **激励反馈**（Duolingo）— 进度条、统计数字、成就感，让管理库存像完成游戏任务
3. **清新柔和** — 暖调用色，年轻不幼稚，精致不严肃

## 色彩系统

### 主色 · Primary（珊瑚粉）

温暖、有活力、美妆调性，不甜腻。

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-primary` | `#FF6B8A` | 品牌色、主按钮、导航高亮、关键操作 |
| `--color-primary-light` | `#FF8FA3` | 按钮悬停/按下 |
| `--color-primary-lighter` | `#FFB3C1` | 轻强调、标签 |
| `--color-primary-bg` | `#FFF0F3` | 主色背景区域 |

### 辅色 · Secondary（薰衣草紫）

精致、年轻、有游戏感的辅助色。

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-secondary` | `#8B5CF6` | 辅助操作、徽章、装饰元素 |
| `--color-secondary-light` | `#A78BFA` | 辅色悬停 |
| `--color-secondary-lighter` | `#C4B5FD` | 辅色标签 |
| `--color-secondary-bg` | `#EDE9FE` | 辅色背景区域 |

### 语义色 · Semantic

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-safe` | `#34D399` | 产品在用/安全状态 |
| `--color-safe-bg` | `#DCFCE7` | 安全状态背景 |
| `--color-warning` | `#FBBF24` | 即将过期 |
| `--color-warning-bg` | `#FEF3C7` | 警告状态背景 |
| `--color-danger` | `#F87171` | 已过期 |
| `--color-danger-bg` | `#FEE2E2` | 危险状态背景 |
| `--color-info` | `#60A5FA` | 提示信息 |
| `--color-info-bg` | `#DBEAFE` | 信息背景 |

### 底色 · Surfaces

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-bg` | `#FFFBF5` | 页面背景（暖白，不是纯白） |
| `--color-surface` | `#FFFFFF` | 卡片、输入框背景 |
| `--color-text-primary` | `#1F1D2B` | 主文字（暖黑，不是纯黑） |
| `--color-text-secondary` | `#6B7280` | 次文字、说明 |
| `--color-text-tertiary` | `#9CA3AF` | 占位符、辅助标签 |
| `--color-border` | `rgba(0,0,0,0.06)` | 分隔线、边框 |

## 字体系统

微信小程序使用系统字体栈，通过字重和大小建立视觉层级。

```css
font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue",
             "PingFang SC", "Microsoft YaHei", sans-serif;
```

| Token | 大小 | 字重 | 行高 | 场景 |
|-------|------|------|------|------|
| `--font-h1` | 28px | 800 (ExtraBold) | 1.3 | 页面主标题 |
| `--font-h2` | 20px | 700 (Bold) | 1.4 | 区块标题 |
| `--font-h3` | 16px | 700 (Bold) | 1.5 | 卡片标题、产品名 |
| `--font-body` | 14px | 400 (Regular) | 1.5 | 正文内容 |
| `--font-caption` | 12px | 600 (SemiBold) | 1.4 | 辅助信息、时间戳 |
| `--font-small` | 10px | 600 (SemiBold) | 1.3 | 微型标签（仅限装饰） |
| `--font-stat` | 24-28px | 800 (ExtraBold) | 1.2 | 统计大数字 |

## 圆角系统

整体保持圆润柔和。

| Token | 数值 | 场景 |
|-------|------|------|
| `--radius-card` | 20px | 卡片 |
| `--radius-button` | 12px | 按钮 |
| `--radius-icon` | 14px | 图标容器 |
| `--radius-input` | 12px | 输入框 |
| `--radius-tag` | 8px | 标签、Badge |
| `--radius-progress` | 3px | 进度条 |
| `--radius-full` | 9999px | 圆形头像、圆形按钮 |

## 阴影系统

| Token | 数值 | 场景 |
|-------|------|------|
| `--shadow-card` | `0 2px 12px rgba(0,0,0,0.06)` | 卡片默认 |
| `--shadow-card-hover` | `0 4px 16px rgba(0,0,0,0.1)` | 卡片按下 |
| `--shadow-float` | `0 8px 24px rgba(0,0,0,0.12)` | 浮层、弹窗 |
| `--shadow-button-press` | `inset 0 2px 4px rgba(0,0,0,0.1)` | 按钮按下态 |

## 间距系统

基于 8px 网格。

| Token | 数值 | 场景 |
|-------|------|------|
| `--space-xs` | 4px | 极小间距 |
| `--space-sm` | 8px | 元素内紧凑间距 |
| `--space-md` | 12px | 组件内边距、卡片间距 |
| `--space-lg` | 16px | 区块内边距、页面水平边距 |
| `--space-xl` | 24px | 区块之间间距 |
| `--space-2xl` | 32px | 大区块分隔 |

## 图标规范

- 使用 SVG 矢量图标，统一线宽 1.5-2px
- 图标容器 44x44px（满足触摸目标最小尺寸）
- 图标视觉大小 20-24px，居中放置
- 图标容器使用渐变填充背景（主色/辅色/语义色渐变）
- **禁止使用 Emoji 作为功能性图标**
- 风格保持 Outline（线性），同一层级不混用 Filled 和 Outline

## 动画规范

| Token | 数值 | 场景 |
|-------|------|------|
| `--duration-fast` | 150ms | 状态切换（开关、选中） |
| `--duration-normal` | 200ms | 微交互（按钮反馈、标签切换） |
| `--duration-slow` | 300ms | 页面转场、模态弹出 |
| `--duration-progress` | 400ms | 进度条动画 |
| `--easing-enter` | `ease-out` | 元素进入 |
| `--easing-exit` | `ease-in` | 元素退出 |
| `--easing-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 弹出层、成就弹窗 |

规则：
- 退出动画时长为进入动画的 60-70%
- 列表项入场逐项延迟 30-50ms
- 尊重系统 `prefers-reduced-motion` 设置
- 进度条使用颜色渐变 + 宽度动画

## 游戏化元素

### 统计卡片

- 使用大号数字（24-28px, ExtraBold）+ 渐变底色
- 每个统计卡片搭配一个 SVG 图标
- 底色使用对应语义色的浅色渐变（如安全数 → 绿色渐变背景）

### 保质期进度条

- 高度 6px，圆角 3px
- 背景色 `#E5E7EB`
- 填充色使用渐变，颜色跟随状态：
  - 安全（>提醒天数）：`linear-gradient(90deg, #34D399, #6EE7B7)`
  - 即将过期（<=提醒天数）：`linear-gradient(90deg, #FBBF24, #FDE68A)`
  - 已过期：`linear-gradient(90deg, #F87171, #FCA5A5)`
- 进度 = 已用时间 / 总保质期

### 状态标签

- 圆角 8px，内边距 4px 10px
- 背景使用语义色的 bg 色，文字使用语义色的深色变体
- 字号 11px, SemiBold

## 几何装饰语言

页面背景使用半透明几何形做装饰，不使用具象插画。

- **圆形**：`opacity: 0.06-0.1`，主色/辅色填充
- **矩形**：带 6px 圆角，微旋转 (15-30deg)，`opacity: 0.08-0.1`
- **三角形**：用 `<polygon>` 绘制等边三角，`opacity: 0.06-0.08`
- 放置于页面顶部/底部/角落，不遮挡内容
- 首页顶部可使用多色渐变背景：`linear-gradient(135deg, #FFF0F3 0%, #EDE9FE 50%, #DCFCE7 100%)`

## 反模式清单

| 避免 | 原因 |
|------|------|
| 冷调蓝绿色（#2196F3, #00BCD4 等） | 传统管理软件感，与产品定位不符 |
| 高饱和彩虹色 | 幼稚感，与"年轻但不幼稚"矛盾 |
| 直角/尖锐形状 | 破坏整体圆润柔和的视觉语言 |
| Emoji 作为功能图标 | 跨平台不一致，无法控制样式 |
| 纯白背景 `#FFFFFF` 做页面底色 | 冰冷感，使用暖白 `#FFFBF5` |
| 纯黑文字 `#000000` | 过于生硬，使用暖黑 `#1F1D2B` |
| 装饰性动画无意义 | 每个动画都需表达因果关系 |
| 同时混用 Filled 和 Outline 图标 | 破坏视觉一致性 |
| 密集排列无留白 | 破坏 Monument Valley 式的呼吸感 |
