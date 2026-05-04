"""
SeekRare Web API Server
Flask 服务，用于接收 VCF 文件和症状输入，调用 SeekRare 进行罕见病诊断
"""

import os
import uuid
import json
import logging
from pathlib import Path
from typing import Optional
from flask import Flask, request, jsonify
from flask_cors import CORS

# 加载 .env 文件
def load_env():
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip())

load_env()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# 配置
UPLOAD_DIR = Path("/tmp/seekrare_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
WORK_DIR = Path("/tmp/seekrare_work")
WORK_DIR.mkdir(parents=True, exist_ok=True)

# 环境变量获取 LLM API 配置
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "openai")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "")

# 可选：参考基因组和注释文件路径（用户需预先配置）
REF_FASTA = os.environ.get("REF_FASTA", "")
GTF_FILE = os.environ.get("GTF_FILE", "")
CLINVAR_VCF = os.environ.get("CLINVAR_VCF", "")
DBSNP_VCF = os.environ.get("DBSNP_VCF", "")


@app.route("/api/health", methods=["GET"])
def health_check():
    """健康检查端点"""
    return jsonify({
        "status": "ok",
        "service": "SeekRare Web API",
        "version": "1.0.0",
        "config": {
            "llm_provider": LLM_PROVIDER,
            "llm_model": LLM_MODEL,
            "has_ref_fasta": bool(REF_FASTA),
            "has_gtf": bool(GTF_FILE),
            "has_clinvar": bool(CLINVAR_VCF),
        }
    })


@app.route("/api/config", methods=["GET"])
def get_config():
    """获取服务端配置信息"""
    return jsonify({
        "llm_provider": LLM_PROVIDER,
        "llm_model": LLM_MODEL,
        "has_ref_fasta": bool(REF_FASTA),
        "has_gtf": bool(GTF_FILE),
        "has_clinvar": bool(CLINVAR_VCF),
        "has_dbsnp": bool(DBSNP_VCF),
        "max_file_size_mb": 500,
        "supported_vcf_formats": [".vcf.gz", ".vcf"],
    })


@app.route("/api/analyze", methods=["POST"])
def analyze():
    """
    分析 VCF 文件和症状，返回诊断结果

    请求参数 (multipart/form-data):
    - proband_vcf: 先证者 VCF 文件
    - father_vcf: 父亲 VCF 文件 (可选)
    - mother_vcf: 母亲 VCF 文件 (可选)
    - symptoms: 患者症状描述 (必填)

    返回: JSON 格式的分析结果
    """
    try:
        # 验证症状描述
        symptoms = request.form.get("symptoms", "").strip()
        if not symptoms:
            return jsonify({"error": "症状描述不能为空"}), 400

        # 创建工作目录
        session_id = str(uuid.uuid4())[:8]
        session_work_dir = WORK_DIR / session_id
        session_work_dir.mkdir(parents=True, exist_ok=True)

        # 保存上传的 VCF 文件
        proband_vcf = request.files.get("proband_vcf")
        if not proband_vcf:
            return jsonify({"error": "必须上传先证者 VCF 文件"}), 400

        proband_path = session_work_dir / "proband.vcf.gz"
        proband_vcf.save(proband_path)
        logger.info(f"保存先证者 VCF: {proband_path}")

        # 处理可选的父亲/母亲 VCF
        father_path = None
        mother_path = None

        father_vcf = request.files.get("father_vcf")
        if father_vcf:
            father_path = session_work_dir / "father.vcf.gz"
            father_vcf.save(father_path)
            logger.info(f"保存父亲 VCF: {father_path}")

        mother_vcf = request.files.get("mother_vcf")
        if mother_vcf:
            mother_path = session_work_dir / "mother.vcf.gz"
            mother_vcf.save(mother_path)
            logger.info(f"保存母亲 VCF: {mother_path}")

        # 构建 SeekRare 配置
        config = {
            "vcf_proband": str(proband_path),
            "vcf_father": str(father_path) if father_path else None,
            "vcf_mother": str(mother_path) if mother_path else None,
            "work_dir": str(session_work_dir),
            "llm_provider": LLM_PROVIDER,
            "llm_model": LLM_MODEL,
            "api_key": LLM_API_KEY,
            "base_url": LLM_BASE_URL if LLM_BASE_URL else None,
            "top_k": 50,
        }

        # 添加可选的参考文件（如果配置了）
        if REF_FASTA:
            config["ref_fasta"] = REF_FASTA
        if GTF_FILE:
            config["gtf_file"] = GTF_FILE
        if CLINVAR_VCF:
            config["clinvar_vcf"] = CLINVAR_VCF
        if DBSNP_VCF:
            config["dbSNP_vcf"] = DBSNP_VCF

        logger.info(f"开始分析... session={session_id}")
        logger.info(f"症状: {symptoms}")

        # 调用 SeekRare
        from seekrare import SeekRarePipeline

        pipeline = SeekRarePipeline(config)

        # Stage 1: VCF 预处理
        logger.info("Stage 1: VCF 预处理...")
        stage1_result = pipeline.stage1_preprocess()
        stage1_info = {
            "total_variants": len(stage1_result),
            "columns": list(stage1_result.columns),
            "sample": stage1_result.head(5).to_dict(orient="records") if len(stage1_result) > 0 else []
        }

        # Stage 3: LLM 分析
        logger.info("Stage 3: LLM 分析...")
        final_result = pipeline.stage3_analyze(
            df=stage1_result,
            symptoms=symptoms,
            skip_stage2=True  # 跳过 Stage 2（需要额外资源）
        )

        # 整理结果
        result = {
            "session_id": session_id,
            "symptoms": symptoms,
            "stage1": stage1_info,
            "candidates": final_result.to_dict(orient="records") if len(final_result) > 0 else [],
            "total_candidates": len(final_result),
            "llm_interpretation": pipeline._llm_interpretation if hasattr(pipeline, '_llm_interpretation') else None,
        }

        # 保存结果文件
        result_path = session_work_dir / "result.json"
        with open(result_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        logger.info(f"分析完成! session={session_id}, candidates={len(final_result)}")

        return jsonify({
            "success": True,
            "data": result,
            "message": f"分析完成，发现 {len(final_result)} 个候选变异"
        })

    except Exception as e:
        logger.error(f"分析失败: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "分析过程中发生错误"
        }), 500


@app.route("/api/analyze/stream", methods=["POST"])
def analyze_stream():
    """
    流式分析接口 - 通过 SSE 返回实时进度
    """
    from flask import Response

    def generate():
        try:
            # 验证输入
            symptoms = request.form.get("symptoms", "").strip()
            if not symptoms:
                yield f"data: {json.dumps({'type': 'error', 'message': '症状描述不能为空'})}\n\n"
                return

            proband_vcf = request.files.get("proband_vcf")
            if not proband_vcf:
                yield f"data: {json.dumps({'type': 'error', 'message': '必须上传先证者 VCF 文件'})}\n\n"
                return

            # 保存文件
            session_id = str(uuid.uuid4())[:8]
            session_work_dir = WORK_DIR / session_id
            session_work_dir.mkdir(parents=True, exist_ok=True)

            proband_path = session_work_dir / "proband.vcf.gz"
            proband_vcf.save(proband_path)

            # 处理可选文件
            father_path = None
            mother_path = None

            father_vcf = request.files.get("father_vcf")
            if father_vcf:
                father_path = session_work_dir / "father.vcf.gz"
                father_vcf.save(father_path)

            mother_vcf = request.files.get("mother_vcf")
            if mother_vcf:
                mother_path = session_work_dir / "mother.vcf.gz"
                mother_vcf.save(mother_path)

            # 构建配置
            config = {
                "vcf_proband": str(proband_path),
                "vcf_father": str(father_path) if father_path else None,
                "vcf_mother": str(mother_path) if mother_path else None,
                "work_dir": str(session_work_dir),
                "llm_provider": LLM_PROVIDER,
                "llm_model": LLM_MODEL,
                "api_key": LLM_API_KEY,
                "base_url": LLM_BASE_URL if LLM_BASE_URL else None,
                "top_k": 50,
            }

            if REF_FASTA:
                config["ref_fasta"] = REF_FASTA
            if GTF_FILE:
                config["gtf_file"] = GTF_FILE
            if CLINVAR_VCF:
                config["clinvar_vcf"] = CLINVAR_VCF
            if DBSNP_VCF:
                config["dbSNP_vcf"] = DBSNP_VCF

            # 发送开始消息
            yield f"data: {json.dumps({'type': 'start', 'session_id': session_id})}\n\n"

            # 调用 SeekRare
            from seekrare import SeekRarePipeline

            pipeline = SeekRarePipeline(config)

            # Stage 1
            yield f"data: {json.dumps({'type': 'progress', 'stage': 1, 'message': '正在处理 VCF 文件...'})}\n\n"
            stage1_result = pipeline.stage1_preprocess()

            yield f"data: {json.dumps({
                'type': 'stage1_complete',
                'stage': 1,
                'total_variants': len(stage1_result),
                'columns': list(stage1_result.columns)
            })}\n\n"

            # Stage 3
            yield f"data: {json.dumps({'type': 'progress', 'stage': 3, 'message': 'LLM 正在分析症状...'})}\n\n"
            final_result = pipeline.stage3_analyze(
                df=stage1_result,
                symptoms=symptoms,
                skip_stage2=True
            )

            # 发送最终结果
            yield f"data: {json.dumps({
                'type': 'complete',
                'session_id': session_id,
                'candidates': final_result.to_dict(orient="records") if len(final_result) > 0 else [],
                'total_candidates': len(final_result),
                'symptoms': symptoms,
                'llm_interpretation': pipeline._llm_interpretation if hasattr(pipeline, '_llm_interpretation') else None
            })}\n\n"

        except Exception as e:
            logger.error(f"流式分析失败: {str(e)}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"启动 SeekRare Web API 服务，端口: {port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
