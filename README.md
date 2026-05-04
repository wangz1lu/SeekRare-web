# SeekRare Web - 罕见病 AI 诊断平台

基于大语言模型（LLM）的罕见病诊断系统 Web 界面。

## 项目概述

SeekRare Web 提供了一个用户友好的网页界面，让医生和研究人员能够：
- 输入患者的临床症状描述
- 上传基因组变异文件（VCF）
- 获得基于 AI 的罕见病候选变异排序结果

## 系统架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Browser   │ ──> │  Flask API      │ ──> │   SeekRare      │
│   (Next.js)    │     │  (Python)       │     │   Package       │
│   Port 5000    │     │   Port 8000     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 快速开始

### 1. 配置环境变量

复制 `.env.example` 为 `.env`，并配置您的 LLM API 密钥：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
LLM_API_KEY=your-api-key-here
```

### 2. 启动服务

#### 开发环境

```bash
pnpm install
pnpm dev
```

这将同时启动：
- Next.js 前端：http://localhost:5000
- Flask API 后端：http://localhost:8000

#### 生产环境

```bash
pnpm install
pnpm run build
pnpm start
```

### 3. 使用平台

1. 打开浏览器访问 http://localhost:5000
2. 输入患者症状描述（如：「智力障碍、癫痫发作、全身肌张力低下」）
3. 上传先证者 VCF 文件（必填）
4. 可选：上传父亲和母亲的 VCF 文件（用于家系分析）
5. 点击「开始分析」
6. 查看候选变异列表和 AI 诊断结果

## 配置参考文件（可选）

SeekRare 支持可选的参考基因组和注释文件，配置后可以启用更完整的分析流程：

| 文件 | 说明 | 下载地址 |
|------|------|----------|
| GRCh38 参考基因组 | 参考基因组 FASTA | https://ftp.ebi.ac.uk/pub/genomes/GRCh38/ |
| GTF 基因注释文件 | NCBI genomic.gtf | https://ftp.ncbi.nlm.nih.gov/genomes/refseq/ |
| ClinVar VCF | 临床变异数据库 | https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf/ |
| dbSNP VCF | dbSNP 变异数据库 | https://ftp.ncbi.nlm.nih.gov/species/newise/ |

配置方法：在 `.env` 文件中添加：

```bash
REF_FASTA=/path/to/GRCh38.fa
GTF_FILE=/path/to/genomic.gtf
CLINVAR_VCF=/path/to/clinvar.vcf.gz
DBSNP_VCF=/path/to/dbsnp.vcf.gz
```

## API 文档

### 健康检查

```bash
curl http://localhost:8000/api/health
```

### 同步分析

```bash
curl -X POST http://localhost:8000/api/analyze \
  -F "symptoms=智力障碍，癫痫" \
  -F "proband_vcf=@proband.vcf.gz"
```

### 流式分析

```bash
curl -X POST http://localhost:8000/api/analyze/stream \
  -F "symptoms=智力障碍，癫痫" \
  -F "proband_vcf=@proband.vcf.gz"
```

## 技术栈

- **前端**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **后端**: Python Flask, SeekRare
- **LLM**: OpenAI GPT-4 / Anthropic Claude 等

## 项目结构

```
.
├── src/                    # Next.js 前端源码
│   └── app/
│       └── page.tsx        # SeekRare 主页面
├── seekrare_api.py         # Python Flask API 服务
├── scripts/                # 启动脚本
├── .env                    # 环境变量配置
└── SeekRare/               # SeekRare Python 包（git submodule）
```

## 部署到 Linux 服务器

1. 克隆代码到服务器
2. 安装 Python 依赖：
   ```bash
   pip install -e ./SeekRare
   pip install flask flask-cors
   ```
3. 配置 `.env` 文件
4. 构建并启动：
   ```bash
   pnpm install
   pnpm run build
   pnpm start
   ```

## License

MIT License - 详见 [SeekRare 仓库](https://github.com/wangz1lu/SeekRare)
