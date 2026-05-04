# SeekRare Web

基于大语言模型（LLM）的**罕见病 AI 诊断平台** Web 界面，为医生和研究人员提供可视化的基因变异分析服务。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/wangz1lu/SeekRare-web/blob/main/LICENSE)
[![SeekRare](https://img.shields.io/badge/Powered%20by-SeekRare-blue.svg)](https://github.com/wangz1lu/SeekRare)

---

## 功能特点

- **智能症状解析**：输入患者临床表型描述，LLM 自动提取相关 HPO 术语
- **VCF 文件分析**：支持先证者及家系（父亲/母亲）VCF 文件上传
- **双动态评分**：基于患者症状个性化调整变异评分权重
- **实时进度显示**：SSE 流式传输分析进度
- **可视化结果**：清晰的候选变异排序表格

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户浏览器                                │
│                     http://your-server:5000                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Next.js 前端 (端口 5000)                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  - 症状输入表单    - VCF 文件上传    - 结果展示表格    │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP API
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Flask API 服务 (端口 8000)                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  /api/health    /api/analyze    /api/analyze/stream   │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │ Python
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SeekRare 核心引擎                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Stage 1     │  │ Stage 2      │  │ Stage 3              │  │
│  │ VCF预处理    │  │ 高级注释      │  │ LLM分析+双动态评分   │  │
│  │ +ClinVar    │  │ (可选)       │  │ +个性化排序          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              LLM API (OpenAI / Anthropic)              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 与 SeekRare 的关系

**SeekRare Web** 是基于 **[SeekRare](https://github.com/wangz1lu/SeekRare)** 核心引擎构建的 Web 部署方案。

| 项目 | 说明 |
|------|------|
| [SeekRare](https://github.com/wangz1lu/SeekRare) | Python 包，罕见病诊断核心算法（三阶段流水线） |
| **SeekRare-web** | Web 前端 + Flask API，基于 SeekRare 的 deployable 版本 |

### 分支关系

```
SeekRare
└── develop 分支 (当前活跃开发)
    ├── Stage 1: VCF 预处理 + ClinVar 注释
    ├── Stage 2: 高级注释 (GTEx eQTL, AlphaFold3)
    └── Stage 3: LLM 分析 + 双动态评分
            │
            ▼ (本项目通过 Flask API 调用)
    SeekRare-web
    ├── src/app/page.tsx  ← Next.js 前端界面
    └── seekrare_api.py   ← Flask API 网关
```

> **说明**：SeekRare-web 使用 `git submodule` 方式集成 SeekRare 包的 `develop` 分支，确保始终使用最新算法。

---

## 快速开始

### 环境要求

- **Node.js**: 18+
- **Python**: 3.10+
- **pnpm**: 最新版本

### 1. 克隆项目

```bash
git clone https://github.com/wangz1lu/SeekRare-web.git
cd SeekRare-web
```

> 如果需要更新 SeekRare 子模块：
> ```bash
> git submodule update --init --recursive
> ```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# ========== LLM 配置（必填）==========
LLM_PROVIDER=openai          # openai / anthropic / local
LLM_MODEL=gpt-4o             # 模型名称
LLM_API_KEY=sk-xxxxxxxxxx    # 你的 API Key

# 可选：API 代理地址
LLM_BASE_URL=

# ========== 参考文件（可选）==========
# 配置后可启用更完整的分析流程
# REF_FASTA=/path/to/GRCh38.fa
# GTF_FILE=/path/to/genomic.gtf
# CLINVAR_VCF=/path/to/clinvar.vcf.gz
# DBSNP_VCF=/path/to/dbsnp.vcf.gz
```

### 3. 安装依赖

```bash
# 安装 Node 依赖
pnpm install

# 安装 Python 依赖（包含 SeekRare）
pip install -e ./SeekRare
pip install flask flask-cors gunicorn
```

### 4. 启动服务

#### 开发环境

```bash
pnpm dev
```

这将同时启动：
- **前端**: http://localhost:5000
- **API**: http://localhost:8000

#### 生产环境

```bash
pnpm run build
pnpm start
```

---

## 使用方法

1. 打开浏览器访问 http://localhost:5000
2. 输入患者症状描述，例如：
   ```
   智力障碍，癫痫发作，全身肌张力低下，发育迟缓
   ```
3. 上传先证者 VCF 文件（**必填**，支持 .vcf.gz 或 .vcf）
4. （可选）上传父亲和母亲的 VCF 文件，用于家系分析
5. 点击「**开始分析**」
6. 查看候选变异列表和 AI 诊断结果

---

## 部署到 Linux 服务器

### 方式一：Docker 部署（推荐）

```bash
# 克隆项目
git clone https://github.com/wangz1lu/SeekRare-web.git
cd SeekRare-web

# 配置环境变量
cp .env.example .env
nano .env  # 填入 LLM_API_KEY

# 启动服务
docker-compose up -d
```

访问 `http://你的服务器IP:5000`

---

### 方式二：手动部署

#### 第一步：安装系统依赖

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs python3 python3-pip build-essential \
    libbz2-dev liblzma-dev libcurl4-openssl-dev libssl-dev git
```

#### 第二步：克隆并配置项目

```bash
git clone https://github.com/wangz1lu/SeekRare-web.git
cd SeekRare-web

# 初始化子模块
git submodule update --init --recursive

# 配置环境变量
cp .env.example .env
nano .env  # 填入 LLM_API_KEY
```

#### 第三步：安装依赖

```bash
# 安装 pnpm
npm install -g pnpm

# 安装 Node 依赖
pnpm install

# 安装 Python 依赖
pip install -e ./SeekRare
pip install flask flask-cors gunicorn
```

#### 第四步：构建并启动

```bash
# 创建目录
mkdir -p logs data/uploads data/work

# 构建前端
pnpm run build

# 启动 API 服务
nohup gunicorn -w 2 -b 0.0.0.0:8000 "seekrare_api:app" > logs/api.log 2>&1 &

# 启动前端服务
nohup pnpm start > logs/web.log 2>&1 &
```

#### 第五步：配置 Nginx（可选，用于域名访问）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API 反向代理
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

---

### 方式三：一键部署脚本

```bash
git clone https://github.com/wangz1lu/SeekRare-web.git
cd SeekRare-web
bash deploy.sh
```

---

## 参考文件配置（可选）

配置参考基因组和注释文件可启用更完整的分析流程：

| 文件 | 说明 | 下载地址 |
|------|------|----------|
| GRCh38 参考基因组 | FASTA + .fai 索引 | [EBI FTP](https://ftp.ebi.ac.uk/pub/genomes/GRCh38/) |
| GTF 基因注释 | NCBI genomic.gtf | [NCBI FTP](https://ftp.ncbi.nlm.nih.gov/genomes/refseq/) |
| ClinVar VCF | 临床变异注释 | [ClinVar FTP](https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf/) |
| dbSNP VCF | dbSNP 变异过滤 | [dbSNP FTP](https://ftp.ncbi.nlm.nih.gov/species/newise/) |

配置方法：在 `.env` 中添加路径：

```bash
REF_FASTA=/data/references/GRCh38.fa
GTF_FILE=/data/references/genomic.gtf
CLINVAR_VCF=/data/references/clinvar.vcf.gz
DBSNP_VCF=/data/references/dbsnp.vcf.gz
```

---

## API 文档

### 健康检查

```bash
curl http://localhost:8000/api/health
```

### 同步分析

```bash
curl -X POST http://localhost:8000/api/analyze \
  -F "symptoms=智力障碍，癫痫发作" \
  -F "proband_vcf=@child.vcf.gz" \
  -F "father_vcf=@father.vcf.gz" \
  -F "mother_vcf=@mother.vcf.gz"
```

### 流式分析（SSE）

```bash
curl -N -X POST http://localhost:8000/api/analyze/stream \
  -F "symptoms=智力障碍，癫痫发作" \
  -F "proband_vcf=@child.vcf.gz"
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16, React 19, TypeScript |
| UI 组件 | shadcn/ui, Tailwind CSS 4 |
| 后端服务 | Python Flask |
| 核心引擎 | [SeekRare](https://github.com/wangz1lu/SeekRare) |
| LLM 支持 | OpenAI GPT-4, Anthropic Claude |

---

## 项目结构

```
seekrare-web/
├── src/
│   └── app/
│       └── page.tsx          # 前端主页面
├── scripts/
│   ├── dev.sh                # 开发环境启动脚本
│   ├── start.sh              # 生产环境启动脚本
│   └── ...
├── SeekRare/                 # SeekRare 核心包（git submodule, develop 分支）
│   ├── src/seekrare/
│   │   ├── pipeline.py        # 三阶段流水线
│   │   ├── llm/              # LLM 模块
│   │   ├── scoring/          # 双动态评分
│   │   └── ...
│   └── scripts/              # 预处理脚本
├── seekrare_api.py           # Flask API 服务
├── Dockerfile                # Docker 配置
├── docker-compose.yml        # Docker Compose 配置
├── deploy.sh                 # 一键部署脚本
├── .env.example              # 环境变量模板
└── README.md
```

---

## License

MIT License - 详见 [SeekRare License](https://github.com/wangz1lu/SeekRare/blob/develop/LICENSE)

---

## 相关项目

- **[SeekRare](https://github.com/wangz1lu/SeekRare)** - 罕见病诊断核心 Python 包
- **[SeekRare Paper](https://...)** - 相关研究论文（待发布）
