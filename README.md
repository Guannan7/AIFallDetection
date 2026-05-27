# 跌倒检测智能识别系统 — 技术文档与使用手册

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 技术架构](#2-技术架构)
- [3. 系统需求与环境配置](#3-系统需求与环境配置)
- [4. 快速开始](#4-快速开始)
- [5. 功能模块详解](#5-功能模块详解)
- [6. 跌倒检测算法](#6-跌倒检测算法)
- [7. AI 增强分析](#7-ai-增强分析)
- [8. 项目目录结构](#8-项目目录结构)
- [9. API 接口文档](#9-api-接口文档)
- [10. 配置项说明](#10-配置项说明)
- [11. 常见问题与排障](#11-常见问题与排障)

---

## 1. 项目概述

**跌倒检测智能识别系统** 是一款基于浏览器端 AI 的实时人体跌倒检测 Web 应用。系统通过 TensorFlow.js + MoveNet 姿态估计模型在浏览器端完成人体关键点提取，结合多维度跌倒判定算法实现毫秒级跌倒识别，并集成通义千问 VL 和 DeepSeek 双 AI 引擎进行增强分析。

### 核心特性

| 特性 | 说明 |
|------|------|
| 图片识别 | 上传静态图片，标注人体骨架与跌倒区域 |
| 视频识别 | 导入本地视频文件，逐帧分析检测跌倒动作 |
| 摄像头实时检测 | 调用设备摄像头，实时采集画面并识别跌倒状态 |
| AI 增强分析 | 通义千问 VL（图像+文本）+ DeepSeek（纯文本）双引擎协同 |
| 声音报警 | 跌倒时自动播放警报音，可开关 |
| 历史记录 | 自动保存检测记录，支持筛选与统计报表 |
| 可视化标注 | Canvas 实时绘制骨架、边界框、状态指示 |
| 响应式设计 | 桌面端/移动端自适应布局 |

---

## 2. 技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      浏览器（前端）                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ CameraDetector│  │ ImageDetector│  │ VideoDetector │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │              │
│         ▼                 ▼                  ▼              │
│  ┌──────────────────────────────────────────────────┐      │
│  │         TensorFlow.js + MoveNet (CDN)             │      │
│  │         姿态估计：17 个人体关键点提取              │      │
│  └──────────────────────┬───────────────────────────┘      │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────┐      │
│  │            FallDetector（跌倒检测算法）            │      │
│  │    躯干角度 + 宽高比 + 头臀距离 + 帧间速度         │      │
│  └──────────────────────┬───────────────────────────┘      │
│                         │                                   │
│         ┌───────────────┼───────────────┐                  │
│         ▼               ▼               ▼                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ 状态面板    │  │ 声音报警    │  │ 历史记录    │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                         │                                   │
│                         ▼ (AI 增强分析请求)                  │
│  ┌──────────────────────────────────────────────────┐      │
│  │            AIAnalyzer（前端组件）                  │      │
│  └──────────────────────┬───────────────────────────┘      │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTP POST (SSE)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Route                         │
│                  /api/analyze                                │
│                                                             │
│         ┌───────────────┴───────────────┐                  │
│         ▼                               ▼                  │
│  ┌──────────────┐              ┌──────────────┐            │
│  │ 通义千问 VL   │              │   DeepSeek   │            │
│  │ qwen-vl-plus │              │ deepseek-chat│            │
│  │ (图像+文本)   │              │  (纯文本)     │            │
│  └──────────────┘              └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈详情

| 分类 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **前端框架** | Next.js | 16 | App Router，SSR/SSG 支持 |
| **UI 框架** | React | 19 | Concurrent Features |
| **语言** | TypeScript | 5 | Strict 模式 |
| **UI 组件** | shadcn/ui | latest | 基于 Radix UI |
| **样式** | Tailwind CSS | 4 | Utility-first CSS |
| **姿态估计** | TensorFlow.js + MoveNet | 4.22.0 / 2.1.3 | CDN 加载，浏览器端推理 |
| **图像 AI** | 通义千问 VL (qwen-vl-plus) | - | 阿里云百炼云，多模态理解 |
| **文本 AI** | DeepSeek (deepseek-chat) | - | 纯文本姿态数据分析 |
| **包管理** | pnpm | - | 仅允许使用 pnpm |

### 2.3 AI 模型选型

| 模型 | 提供方 | 用途 | 输入 | 输出 |
|------|--------|------|------|------|
| **MoveNet SinglePose Lightning** | Google / TensorFlow | 人体姿态估计 | 图像/视频帧 | 17 个关键点坐标+置信度 |
| **qwen-vl-plus** | 阿里云百炼 | 图像增强分析 | 图像 + 姿态文本 | 跌倒风险评估报告 |
| **deepseek-chat** | DeepSeek | 文本增强分析 | 姿态文本数据 | 跌倒风险评估报告 |

---

## 3. 系统需求与环境配置

### 3.1 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10+ / macOS 12+ / Linux (Ubuntu 20.04+) |
| Node.js | 18.x+ (推荐 20.x+) |
| pnpm | 8.x+ |
| 浏览器 | Chrome 90+ / Edge 90+ / Firefox 90+ / Safari 15+（需支持 WebGL） |
| 摄像头 | USB 摄像头或内置摄像头（实时检测模式需要） |
| 网络 | 需要访问 CDN（TensorFlow.js 模型加载）和 AI API 服务 |

### 3.2 API Key 获取

1. **通义千问百炼云 API Key**
   - 访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/)
   - 注册/登录阿里云账号
   - 开通百炼服务，创建 API Key
   - 确保账户有可用额度

2. **DeepSeek API Key**
   - 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
   - 注册/登录账号
   - 在 API Keys 页面创建新 Key
   - 确保账户有可用额度

---

## 4. 快速开始

### 4.1 本地 PyCharm 运行

#### Step 1：打开项目

```
PyCharm → File → Open → 选择项目根目录
```

#### Step 2：安装依赖

在 PyCharm 内置终端中执行：

```bash
pnpm install
```

#### Step 3：配置环境变量

在项目根目录创建 `.env.local` 文件：

```env
DEEPSEEK_API_KEY=你的DeepSeek_API_Key
QWEN_API_KEY=你的通义千问_API_Key
```

> 两个 Key 至少配置一个。若仅配置 DeepSeek，AI 增强分析将只支持文本模式（无图像理解）；建议两个都配置以获得最佳体验。

#### Step 4：启动开发服务器

```bash
pnpm dev
```

服务器默认运行在 `http://localhost:5000`，在浏览器中打开即可使用。

#### Step 5：（可选）构建生产版本

```bash
pnpm build
pnpm start
```

### 4.2 命令行运行

```bash
# 克隆项目后进入目录
cd fall-detection-system

# 安装依赖
pnpm install

# 配置 API Key
echo "DEEPSEEK_API_KEY=sk-xxx" > .env.local
echo "QWEN_API_KEY=sk-xxx" >> .env.local

# 启动开发
pnpm dev
```

---

## 5. 功能模块详解

### 5.1 图片识别

**使用流程：**

1. 在左侧功能选项区点击「图片识别」标签
2. 点击「选择图片」按钮或拖拽图片到预览区
3. 系统自动加载 MoveNet 模型（首次加载约 3-5 秒）
4. 模型就绪后自动识别图片中的人体姿态
5. 画面上标注骨架关键点和边界框
6. 右侧状态面板显示：检测状态、躯干角度、宽高比、置信度
7. 底部显示详细检测结果（角度、宽高比、头臀距离比）
8. 如需 AI 增强分析，点击「AI 增强分析」按钮

**支持格式：** JPG、PNG、WebP、BMP

**注意事项：**
- 图片中需包含完整人体（至少肩部和臀部可见）
- 多人场景下仅检测最显著的人体
- 光线充足、背景简洁时识别效果更佳

### 5.2 视频识别

**使用流程：**

1. 在左侧功能选项区点击「视频识别」标签
2. 点击「选择视频」按钮导入本地视频文件
3. 视频加载后点击「播放」开始逐帧分析
4. 实时标注骨架和跌倒区域
5. 右侧面板实时更新检测状态和 FPS
6. 检测到跌倒时触发声音报警和弹窗提示

**支持格式：** MP4、WebM、MOV（取决于浏览器支持）

**注意事项：**
- 视频分辨率建议不超过 1920x1080，过高会影响帧率
- 分析帧率取决于设备 GPU 性能，通常 15-30 FPS
- 长视频建议分段分析

### 5.3 摄像头实时检测

**使用流程：**

1. 在左侧功能选项区点击「摄像头检测」标签
2. 点击「开始检测」按钮
3. 浏览器弹出摄像头授权弹窗，点击「允许」
4. 模型加载完成后自动开始实时检测
5. 画面实时标注骨架和状态
6. 检测到跌倒时自动报警
7. 点击「截图」可保存当前帧
8. 点击「停止检测」结束

**注意事项：**
- 需要浏览器授予摄像头权限
- 建议使用 USB 摄像头以获得更稳定的画面
- 检测距离建议 1.5-4 米
- 确保被检测者全身可见

### 5.4 灵敏度调节

在右侧控制面板可通过滑块调节检测灵敏度：

| 灵敏度 | 阈值调整 | 适用场景 |
|--------|---------|---------|
| 低 (0-0.3) | 更严格的判定标准 | 减少误报，适合日常监控 |
| 中 (0.3-0.7) | 平衡模式 | 通用场景（默认） |
| 高 (0.7-1.0) | 更宽松的判定标准 | 高危人群看护，宁可误报不可漏报 |

### 5.5 AI 增强分析

点击「AI 增强分析」按钮后：

1. **有图像数据时**（图片/摄像头截图/视频帧）→ 调用通义千问 VL
   - 同时发送图像和姿态关键点数据
   - AI 可直观看到画面中的人体姿态
   - 分析结果更准确，适合复杂场景

2. **无图像数据时** → 调用 DeepSeek
   - 仅发送姿态关键点文本数据
   - 适合纯数据模式下的辅助判断

**AI 分析返回内容：**
- 是否跌倒（是/否/疑似）
- 置信度（0-100%）
- 详细分析说明
- 处理建议

### 5.6 声音报警

- 跌倒检测触发时自动播放警报音（880Hz/660Hz 交替方波）
- 可通过「报警开关」按钮开启/关闭
- 报警持续 0.5 秒，不会循环播放
- 前端使用 Web Audio API 生成，无需音频文件

### 5.7 历史记录与统计

- 所有检测结果自动保存到浏览器 localStorage
- 最多保留 100 条记录
- 支持按类型筛选（图片/视频/摄像头）
- 统计面板显示：总检测次数、跌倒次数、正常次数、各类型占比
- 支持单条删除和清空全部记录

---

## 6. 跌倒检测算法

### 6.1 算法概述

跌倒检测算法基于 MoveNet 输出的 17 个人体关键点，通过**多维度特征融合 + 置信度加权评分 + 连续帧确认**机制判断跌倒状态。

### 6.2 MoveNet 关键点定义

MoveNet SinglePose Lightning 模型输出 17 个关键点：

| 索引 | 名称 | 英文 | 说明 |
|------|------|------|------|
| 0 | 鼻 | nose | 头部定位参考 |
| 1 | 左眼 | left_eye | |
| 2 | 右眼 | right_eye | |
| 3 | 左耳 | left_ear | |
| 4 | 右耳 | right_ear | |
| 5 | 左肩 | left_shoulder | 躯干定位关键点 |
| 6 | 右肩 | right_shoulder | 躯干定位关键点 |
| 7 | 左肘 | left_elbow | |
| 8 | 右肘 | right_elbow | |
| 9 | 左腕 | left_wrist | |
| 10 | 右腕 | right_wrist | |
| 11 | 左臀 | left_hip | 躯干定位关键点 |
| 12 | 右臀 | right_hip | 躯干定位关键点 |
| 13 | 左膝 | left_knee | |
| 14 | 右膝 | right_knee | |
| 15 | 左踝 | left_ankle | |
| 16 | 右踝 | right_ankle | |

### 6.3 四维特征提取

#### 特征 1：躯干倾斜角度 (Torso Tilt Angle)

**权重：0.35**

```
肩部中点 = (左肩 + 右肩) / 2
臀部中点 = (左臀 + 右臀) / 2
倾斜角度 = atan2(|肩臀水平距离|, |肩臀垂直距离|) × 180/π
```

- 正常站立：0° - 15°
- 前倾/侧倾：15° - 45°
- 跌倒状态：> 45°（阈值 `FALL_ANGLE_THRESHOLD = 45°`）

#### 特征 2：身体宽高比 (Aspect Ratio)

**权重：0.25**

```
有效关键点边界框:
  宽度 W = max(x) - min(x)
  高度 H = max(y) - min(y)
  宽高比 = W / H
```

- 正常站立：0.2 - 0.5（高度远大于宽度）
- 弯腰/蹲下：0.5 - 0.8
- 跌倒状态：> 0.8（宽度接近或超过高度，阈值 `ASPECT_RATIO_THRESHOLD = 0.8`）

#### 特征 3：头部-臀部垂直距离比 (Head-Hip Ratio)

**权重：0.25**

```
头部-臀部距离 = 臀部中点.y - 鼻子.y   (正值表示头在臀部上方)
身体高度 = |臀部中点.y - 踝骨中点.y|
头臀距离比 = 头部-臀部距离 / 身体高度
```

- 正常站立：> 0.5（头部远高于臀部）
- 弯腰/蹲下：0.2 - 0.5
- 跌倒状态：< 0.2（头部与臀部处于同一水平线或更低，阈值 `HEAD_HIP_RATIO_THRESHOLD = 0.2`）

#### 特征 4：帧间位移速度 (Velocity)

**权重：0.15**

```
对每个有效关键点 i:
  位移 d[i] = sqrt((x[i] - prev_x[i])² + (y[i] - prev_y[i])²)
平均位移 = sum(d) / count
速度 v = 平均位移 / 时间间隔 Δt
归一化速度 = min(v / 100, 1)
```

- 正常移动：0 - 0.05
- 快速移动：0.05 - 0.15
- 跌倒瞬间：> 0.15（阈值 `VELOCITY_THRESHOLD = 0.15`）

### 6.4 综合评分机制

```typescript
fallScore = 0;

if (躯干倾斜角度 > 45°)    fallScore += 0.35;
if (宽高比 > 0.8)           fallScore += 0.25;
if (头臀距离比 < 0.2)       fallScore += 0.25;
if (帧间速度 > 0.15)        fallScore += 0.15;

初步判定跌倒 = fallScore >= 0.5;
```

### 6.5 连续帧确认机制

为避免单帧误判，采用**连续帧确认**策略：

```
if (初步判定跌倒):
    fallFrameCount++
else:
    fallFrameCount = max(0, fallFrameCount - 1)  // 渐进衰减

确认跌倒 = fallFrameCount >= 3   // 连续 3 帧确认
```

### 6.6 状态机

```
standing ──(fallScore≥0.5 且 frameCount>0)──→ falling
falling ──(frameCount≥3)──→ fallen
fallen ──(fallScore<0.5 且 frameCount衰减至0)──→ standing
任意状态 ──(关键点不足)──→ unknown
```

| 状态 | 含义 | 显示颜色 |
|------|------|---------|
| `standing` | 正常站立 | 绿色 |
| `falling` | 正在跌倒（过渡态） | 黄色 |
| `fallen` | 已跌倒 | 红色 |
| `unknown` | 无法判断（关键点不足） | 灰色 |

### 6.7 关键点置信度过滤

所有关键点参与计算前需满足最低置信度阈值：

```
MIN_KEYPOINT_SCORE = 0.3
```

低于此阈值的关键点不参与计算。若核心关键点（肩部+臀部）不足 3 个，直接返回 `unknown` 状态。

### 6.8 灵敏度调节实现

灵敏度参数 `sensitivity`（0-1）影响跌倒确认的帧数阈值：

```
实际确认帧数 = max(1, round(3 × (1.5 - sensitivity)))
```

- sensitivity = 1（高灵敏度）→ 确认帧数 = 1（单帧即触发）
- sensitivity = 0.5（默认）→ 确认帧数 = 3
- sensitivity = 0（低灵敏度）→ 确认帧数 = 5

---

## 7. AI 增强分析

### 7.1 双引擎架构

系统根据是否存在图像数据自动选择 AI 引擎：

```
┌─────────────────┐     有 imageData     ┌─────────────────┐
│                 │ ────────────────────→ │  通义千问 VL     │
│  /api/analyze   │                       │  qwen-vl-plus   │
│  (API Route)    │                       │  图像 + 文本     │
│                 │ ────────────────────→ │                 │
└─────────────────┘     无 imageData      ┌─────────────────┐
                        ────────────────→ │  DeepSeek       │
                                          │  deepseek-chat  │
                                          │  纯文本          │
                                          └─────────────────┘
```

### 7.2 通义千问 VL 调用

- **API 端点**: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- **模型**: `qwen-vl-plus`
- **输入格式**: OpenAI 兼容多模态格式
  ```json
  {
    "model": "qwen-vl-plus",
    "messages": [
      { "role": "system", "content": "跌倒检测AI分析助手提示词" },
      { "role": "user", "content": [
        { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } },
        { "type": "text", "text": "姿态关键点数据 + 分析请求" }
      ]}
    ],
    "temperature": 0.3,
    "stream": true
  }
  ```
- **输出**: SSE 流式响应，前端逐字渲染

### 7.3 DeepSeek 调用

- **API 端点**: `https://api.deepseek.com/chat/completions`
- **模型**: `deepseek-chat`
- **输入格式**: OpenAI 兼容纯文本格式
  ```json
  {
    "model": "deepseek-chat",
    "messages": [
      { "role": "system", "content": "跌倒检测AI分析助手提示词" },
      { "role": "user", "content": "姿态关键点文本数据 + 分析请求" }
    ],
    "temperature": 0.3,
    "stream": true
  }
  ```
- **输出**: SSE 流式响应，前端逐字渲染

### 7.4 流式响应处理

后端将 AI 返回的 SSE 流原样转发，前端通过 `ReadableStream` 逐块解析：

```
SSE 数据格式:
data: {"choices":[{"delta":{"content":"根"}}]}
data: {"choices":[{"delta":{"content":"据"}}]}
data: {"choices":[{"delta":{"content":"分"}}]}
...
data: [DONE]
```

前端实时拼接 `delta.content`，实现打字机效果。

---

## 8. 项目目录结构

```
├── public/                          # 静态资源
├── scripts/                         # 构建与启动脚本
│   └── dev.sh                       # 开发环境启动脚本
├── src/
│   ├── app/                         # 页面路由与布局
│   │   ├── api/
│   │   │   └── analyze/
│   │   │       └── route.ts         # AI 增强分析 API（通义千问 + DeepSeek）
│   │   ├── globals.css              # 全局样式 + 自定义动画
│   │   ├── layout.tsx               # 根布局（字体、元数据）
│   │   └── page.tsx                 # 主页面（检测模式切换、布局编排）
│   ├── components/
│   │   ├── detection/               # 检测功能组件
│   │   │   ├── CameraDetector.tsx   # 摄像头实时检测
│   │   │   ├── ImageDetector.tsx    # 图片识别
│   │   │   ├── VideoDetector.tsx    # 视频识别
│   │   │   ├── HistoryPanel.tsx     # 历史记录面板
│   │   │   ├── AIAnalyzer.tsx       # AI 增强分析（SSE 流式）
│   │   │   └── StatusPanel.tsx      # 状态面板（实时指标）
│   │   └── ui/                      # shadcn/ui 组件库
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── slider.tsx
│   │       └── ...
│   ├── hooks/
│   │   ├── use-detection-history.ts # 检测历史 Hook（localStorage 持久化）
│   │   └── use-alert.ts             # 报警 Hook（Web Audio API）
│   └── lib/
│       ├── fall-detector.ts         # 跌倒检测算法（核心）
│       ├── pose-engine.ts           # 姿态估计引擎（CDN 动态加载 TF.js）
│       └── utils.ts                 # 工具函数
├── .env.local                       # 环境变量（API Keys）
├── .coze                            # 项目配置文件
├── AGENTS.md                        # 项目规范文件
├── DESIGN.md                        # 设计规范文件
├── next.config.ts                   # Next.js 配置
├── package.json                     # 依赖管理
└── tsconfig.json                    # TypeScript 配置
```

---

## 9. API 接口文档

### 9.1 AI 增强分析接口

**POST** `/api/analyze`

发送姿态数据和/或图像数据至 AI 引擎获取增强分析结果。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `poseData` | object | 否* | 姿态关键点数据 |
| `poseData.keypoints` | array | 是 | 关键点数组 |
| `poseData.keypoints[].name` | string | 是 | 关键点名称 |
| `poseData.keypoints[].x` | number | 是 | X 坐标 |
| `poseData.keypoints[].y` | number | 是 | Y 坐标 |
| `poseData.keypoints[].score` | number | 是 | 置信度 (0-1) |
| `poseData.score` | number | 否 | 整体姿态置信度 |
| `poseData.detectionResult` | object | 否 | 本地检测结果摘要 |
| `imageData` | string | 否* | Base64 编码图像（data:image/... 格式） |
| `mode` | string | 否 | 检测模式：`image` / `video` / `camera` |

> *`poseData` 和 `imageData` 至少需要一个

**请求示例：**

```json
{
  "poseData": {
    "keypoints": [
      { "name": "nose", "x": 320.5, "y": 120.3, "score": 0.92 },
      { "name": "left_shoulder", "x": 280.1, "y": 220.7, "score": 0.88 }
    ],
    "score": 0.85,
    "detectionResult": {
      "isFall": false,
      "confidence": 0.15,
      "angle": 12,
      "aspectRatio": 0.35,
      "state": "standing"
    }
  },
  "imageData": "data:image/jpeg;base64,/9j/4AAQ...",
  "mode": "image"
}
```

**响应：**

- 有 imageData → 通义千问 VL 处理（SSE 流式）
- 无 imageData → DeepSeek 处理（SSE 流式）

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"id":"...","choices":[{"delta":{"content":"根据"}}]}
data: {"id":"...","choices":[{"delta":{"content":"提供的"}}]}
...
data: [DONE]
```

**错误响应：**

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少姿态数据或图像数据 |
| 500 | API Key 未配置或 AI 服务调用失败 |

### 9.2 健康检查接口

**GET** `/api/analyze`

```json
{ "status": "ok", "service": "fall-detection-ai-analyzer" }
```

---

## 10. 配置项说明

### 10.1 环境变量

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `DEEPSEEK_API_KEY` | 建议配置 | DeepSeek API 密钥 | `sk-072a...` |
| `QWEN_API_KEY` | 建议配置 | 通义千问百炼云 API 密钥 | `sk-aa8b...` |
| `DEPLOY_RUN_PORT` | 自动 | 服务监听端口（默认 5000） | `5000` |

### 10.2 算法参数（fall-detector.ts）

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MIN_KEYPOINT_SCORE` | 0.3 | 关键点最低置信度阈值 |
| `FALL_ANGLE_THRESHOLD` | 45° | 躯干倾斜角度阈值 |
| `ASPECT_RATIO_THRESHOLD` | 0.8 | 身体宽高比阈值 |
| `HEAD_HIP_RATIO_THRESHOLD` | 0.2 | 头臀距离比阈值 |
| `VELOCITY_THRESHOLD` | 0.15 | 帧间速度阈值 |
| `FALL_CONFIRM_FRAMES` | 3 | 连续确认帧数 |

### 10.3 历史记录配置（use-detection-history.ts）

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MAX_RECORDS` | 100 | 最大保存记录数 |
| `STORAGE_KEY` | `fall_detection_history` | localStorage 存储键 |

---

## 11. 常见问题与排障

### Q1：模型加载失败或加载缓慢

**现象**：状态面板显示「模型加载中」长时间不变

**排查**：
1. 检查网络连接，TensorFlow.js 需从 CDN 加载约 10MB 模型文件
2. 如果在国内网络环境，CDN 可能较慢，耐心等待或使用代理
3. 检查浏览器控制台是否有 CORS 或网络错误
4. 确保浏览器支持 WebGL（在地址栏输入 `chrome://gpu` 查看）

### Q2：摄像头无法打开

**排查**：
1. 确认浏览器已授予摄像头权限
2. 检查是否有其他程序占用摄像头
3. macOS 需在「系统偏好设置 → 安全性与隐私 → 摄像头」中允许浏览器访问
4. HTTPS 环境下才能访问摄像头（localhost 除外）

### Q3：AI 增强分析返回 400 错误

**排查**：
1. 检查 `.env.local` 中的 API Key 是否正确
2. 确认 API Key 对应账户有可用额度
3. 查看浏览器控制台和服务器日志中的详细错误信息

### Q4：检测帧率低

**排查**：
1. MoveNet SinglePose Lightning 模型对 GPU 有要求，确保浏览器启用了硬件加速
2. 降低视频分辨率（建议不超过 720p）
3. 关闭其他占用 GPU 的应用
4. Chrome 浏览器性能通常优于 Firefox

### Q5：误报率高

**调整**：
1. 降低灵敏度滑块
2. 确保被检测者全身在画面中
3. 调整摄像头角度，尽量正面拍摄
4. 在 `fall-detector.ts` 中调整 `FALL_ANGLE_THRESHOLD` 等参数

### Q6：本地 PyCharm 运行报错 `pnpm: command not found`

**解决**：
1. 全局安装 pnpm：`npm install -g pnpm`
2. 或使用 Corepack：`corepack enable && corepack prepare pnpm@latest --activate`
3. 在 PyCharm 终端中验证：`pnpm --version`

### Q7：生产环境部署

```bash
# 构建
pnpm build

# 启动
pnpm start

# 或使用 PM2 守护进程
pm2 start npm --name "fall-detection" -- start
```

---

## 附录：系统提示词（AI 增强分析 System Prompt）

```
你是一个专业的跌倒检测AI分析助手。根据人体姿态关键点数据和/或画面图像，
分析当前人体状态是否为跌倒。

你需要综合考虑以下因素：
1. 躯干倾斜角度（正常站立约0-15°，跌倒通常>45°）
2. 身体宽高比（站立时高度>宽度，跌倒时宽度接近或大于高度）
3. 头部相对臀部的位置关系
4. 帧间位移速度
5. 关键点置信度
6. 画面中人体的实际姿态（如有图像）

请以结构化格式回复，包含以下内容：
- 是否跌倒（是/否/疑似）
- 置信度（0-100%）
- 详细分析说明
- 处理建议
```
