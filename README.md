# SeekRare Web

罕见病 AI 诊断平台的 Web 前端，基于 [SeekRare](https://github.com/wangz1lu/SeekRare) Python 包构建。

## 项目关系

```
SeekRare-web
    │
    ├── 前端 (Next.js)        端口 5000
    │
    └── 后端 API (Flask)       端口 8000
            │
            └── SeekRare Python 包 (develop 分支)
                    │
                    ├── Stage 1: VCF 预处理与注释
                    ├── Stage 2: eQTL 注释 (可选)
                    ├── Stage 3: LLM 表型匹配排序
                    └── Stage 4: 高级分析 (GENOS/AlphaFold3)
```

> ⚠️ **重要**: 本项目基于 [SeekRare](https://github.com/wangz1lu/SeekRare) 的 `develop` 分支构建，依赖 SeekRare Python 包作为核心分析引擎。

## 功能特性

### 核心分析流程 (三阶段)

1. **Stage 1 - VCF 预处理**
   - 支持先证者 VCF 文件上传
   - 可选：父亲/母亲 VCF 文件（用于家系分析）
   - 自动基因组注释

2. **Stage 2 - eQTL 注释** (可选)
   - GTEx 组织表达数据
   - 功能变异优先级评估

3. **Stage 3 - LLM 表型匹配排序**
   - 自然语言症状解析 (HPO 术语)
   - 基于表型-基因匹配的 LLM 智能排序

### 高级分析 (Stage 4)

勾选候选变异后，可执行高级分析：

| 模块 | 功能 |
|------|------|
| **GENOS 致病位点扫描** | Genos 模型深度致病性分析 |
| **AlphaFold3 结构预测** | 蛋白质三维结构预测 |

分析结果以图片形式展示在结果表格中。

## 系统要求

- Python 3.10+
- Node.js 18+
- pnpm 8+
- SeekRare Python 包 (develop 分支)

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/wangz1lu/SeekRare-web.git
cd SeekRare-web
```

### 2. 安装 SeekRare 依赖

SeekRare-web 依赖 SeekRare Python 包作为核心引擎：

```bash
# 克隆 SeekRare (确保使用 develop 分支)
git clone -b develop https://github.com/wangz1lu/SeekRare.git

# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate

# 安装 SeekRare
cd SeekRare
pip install -e .
cd ..
```

### 3. 配置环境变量

```bash
cp .env.example .env
nano .env
```

编辑 `.env` 文件，配置以下必需变量：

```env
# LLM API 配置 (必需)
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
LLM_API_KEY=your-api-key-here

# 可选：API 代理
LLM_BASE_URL=

# 前端 API 地址
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. 安装前端依赖

```bash
pnpm install
```

### 5. 启动服务

#### 开发环境

```bash
# 同时启动前端和后端
pnpm dev
```

或分别启动：

```bash
# 终端 1: 启动后端 API
python3 seekrare_api.py

# 终端 2: 启动前端
pnpm run dev
```

#### 生产环境

```bash
# 构建
pnpm build

# 启动
pnpm start
```

## 部署方式

### Docker 部署 (推荐)

```bash
# 克隆项目
git clone https://github.com/wangz1lu/SeekRare-web.git
cd SeekRare-web

# 配置环境变量
cp .env.example .env
nano .env

# 构建并启动
docker-compose up -d
```

### 一键部署脚本

```bash
bash deploy.sh
```

### 手动部署

1. 安装 Python 依赖：
```bash
pip install flask flask-cors seekrare
```

2. 安装 Node.js 依赖：
```bash
pnpm install && pnpm build
```

3. 启动服务：
```bash
# 后端 (端口 8000)
python3 seekrare_api.py &

# 前端 (端口 5000)
pnpm start
```

## API 文档

### 健康检查

```bash
GET /api/health
```

响应：
```json
{
  "status": "healthy",
  "seekrare_available": true,
  "version": "2.0.0"
}
```

### 配置信息

```bash
GET /api/config
```

### 同步分析

```bash
POST /api/analyze
Content-Type: multipart/form-data

# 表单字段
symptoms: 症状描述文本
proband_vcf: 先证者 VCF 文件 (必需)
father_vcf: 父亲 VCF 文件 (可选)
mother_vcf: 母亲 VCF 文件 (可选)
```

### 流式分析 (SSE)

```bash
POST /api/analyze/stream
Content-Type: multipart/form-data
```

响应事件：
- `progress` - 进度更新
- `complete` - 分析完成
- `error` - 错误信息

### 高级分析

```bash
POST /api/advanced-analyze
Content-Type: application/json

{
  "session_id": "xxx",
  "selected_rows": [1, 2, 3],
  "analysis_type": "genos" | "alphafold",
  "csv_data": [...]
}
```

## 项目结构

```
seekrare-web/
├── src/
│   └── app/
│       └── page.tsx          # 主页面 (Next.js App Router)
├── seekrare_api.py           # Flask 后端 API
├── scripts/
│   ├── dev.sh                # 开发环境启动脚本
│   └── start.sh              # 生产环境启动脚本
├── Dockerfile                # Docker 配置
├── docker-compose.yml        # Docker Compose 配置
├── deploy.sh                 # 一键部署脚本
├── .env                      # 环境变量
└── README.md
```

## 可选：参考基因组文件

如需完整功能，可下载以下参考文件：

```bash
# 创建目录
mkdir -p reference

# 下载参考基因组 (GRCh38)
wget -P reference/ https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.fa.gz

# 下载 GENCODE 基因注释
wget -P reference/ https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_44/gencode.v44.annotation.gtf.gz

# 下载 ClinVar VCF
wget -P reference/ https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/clinvar.vcf.gz
```

并在 `.env` 中配置：

```env
REF_FASTA=/path/to/hg38.fa.gz
GTF_FILE=/path/to/gencode.v44.annotation.gtf.gz
CLINVAR_VCF=/path/to/clinvar.vcf.gz
```

## 故障排除

### SeekRare 包未安装

```bash
# 检查是否安装
python3 -c "import seekrare; print(seekrare.__version__)"

# 如未安装
pip install -e /path/to/SeekRare
```

### API 连接失败

确保后端服务运行在端口 8000：
```bash
curl http://localhost:8000/api/health
```

### VCF 文件格式错误

确保 VCF 文件：
- 格式正确 (.vcf 或 .vcf.gz)
- 包含先证者数据
- 染色体命名一致 (如 chr1 或 1)

## 许可证

MIT License

## 联系方式

- GitHub: https://github.com/wangz1lu/SeekRare
- Issues: https://github.com/wangz1lu/SeekRare/issues
