# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **后端**: Python Flask API (端口 8000)
- **核心功能**: SeekRare 罕见病 AI 诊断平台

## 项目概述

SeekRare Web 是一个基于大语言模型（LLM）的罕见病诊断平台，用于分析患者临床表型和基因组变异数据。

### 架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js 前端   │ ──> │  Flask API 后端  │ ──> │   SeekRare 包   │
│   (端口 5000)   │     │   (端口 8000)    │     │   (Python)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 服务配置

- **前端服务**: http://localhost:5000 (Next.js)
- **API 服务**: http://localhost:8000 (Python Flask)
- **环境变量**: `.env` 文件配置 LLM API 密钥

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本（同时启动前端+后端）
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   │   └── page.tsx       # SeekRare 主页面
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   └── utils.ts        # 通用工具函数 (cn)
│   └── server.ts           # 自定义服务端入口
├── seekrare_api.py         # Python Flask API 服务
├── .env                    # 环境变量配置
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**

## SeekRare API 开发指南

### API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/config` | GET | 获取服务端配置 |
| `/api/analyze` | POST | 同步分析接口 |
| `/api/analyze/stream` | POST | 流式分析接口 (SSE) |

### 环境变量配置 (.env)

```bash
# LLM API 配置（必填）
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=  # 可选，用于代理或其他 API

# 可选：参考基因组和注释文件路径
# REF_FASTA=/path/to/GRCh38.fa
# GTF_FILE=/path/to/genomic.gtf
# CLINVAR_VCF=/path/to/clinvar.vcf.gz
# DBSNP_VCF=/path/to/dbsnp.vcf.gz
```

### 启动服务

```bash
# 开发环境（同时启动前端+后端）
pnpm dev

# 或者分别启动
# 1. 启动 Python API
python3 seekrare_api.py

# 2. 启动 Next.js 前端
pnpm run dev
```

### SeekRare 包依赖

SeekRare 包已安装在系统 Python 环境中，位于 `/workspace/projects/SeekRare/`。

如需更新或重新安装：
```bash
cd /workspace/projects/SeekRare
pip install -e .
```

### 前端调用 API

前端通过 `NEXT_PUBLIC_API_URL` 环境变量指定 API 地址：
- 开发环境：`http://localhost:8000`
- 生产环境：根据部署环境配置

### 流式响应 (SSE)

`/api/analyze/stream` 接口返回 Server-Sent Events 格式的实时进度：
- `type: start` - 开始分析
- `type: progress` - 进度更新
- `type: stage1_complete` - Stage 1 完成
- `type: complete` - 分析完成，包含最终结果
- `type: error` - 错误信息
