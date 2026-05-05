#!/usr/bin/env python3
"""
SeekRare Web API Server
基于 Flask 的后端 API，用于调用 SeekRare Python 包进行分析
"""

import os
import uuid
import json
import csv
import asyncio
import threading
from pathlib import Path
from datetime import datetime
from typing import Optional

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Try to import SeekRare
try:
    from seekrare.pipeline import RareDiseaseAnalyzer
    SEEKrare_AVAILABLE = True
except ImportError:
    SEEKrare_AVAILABLE = False
    print("Warning: SeekRare not installed. Running in demo mode.")

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_DIR = Path("/tmp/seekrare/uploads")
WORK_DIR = Path("/tmp/seekrare/work")
RESULTS_DIR = Path("/tmp/seekrare/results")

# Create directories
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
WORK_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal"""
    return os.path.basename(filename)


def parse_csv_to_rows(csv_path: str) -> list:
    """Parse CSV file to list of dictionaries"""
    rows = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            row['id'] = i + 1
            rows.append(row)
    return rows


def emit_sse_event(stream, event_type: str, data: dict):
    """Emit SSE event to stream"""
    message = f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
    stream.write(message.encode())
    stream.flush()


def run_seekrare_analysis(
    session_id: str,
    symptoms: str,
    proband_vcf: str,
    father_vcf: Optional[str] = None,
    mother_vcf: Optional[str] = None,
    stream=None
):
    """
    Run SeekRare analysis pipeline
    
    Pipeline stages:
    1. VCF preprocessing and annotation
    2. eQTL annotation (optional)
    3. LLM-based ranking
    4. Advanced analysis (Genos/AlphaFold3) - on-demand
    """
    try:
        if not SEEKrare_AVAILABLE:
            # Demo mode - generate sample results
            emit_sse_event(stream, "message", {
                "type": "progress",
                "stage": 1,
                "message": "VCF 预处理中..."
            })
            import time
            time.sleep(2)
            
            emit_sse_event(stream, "message", {
                "type": "progress", 
                "stage": 2,
                "message": "基因组注释..."
            })
            time.sleep(2)
            
            emit_sse_event(stream, "message", {
                "type": "progress",
                "stage": 3,
                "message": "LLM 正在分析表型匹配..."
            })
            time.sleep(3)
            
            emit_sse_event(stream, "message", {
                "type": "progress",
                "stage": 3,
                "message": "生成候选变异排序..."
            })
            time.sleep(1)
            
            # Generate demo CSV
            demo_csv = WORK_DIR / session_id / "candidates.csv"
            demo_csv.parent.mkdir(parents=True, exist_ok=True)
            
            with open(demo_csv, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'CHROM', 'POS', 'REF', 'ALT', 'gene_name', 
                    'transcript', 'variant_type', 'hgvs_cdna', 
                    'clinsig', 'inheritance_type', 'seekrare_score'
                ])
                # Sample data
                demo_data = [
                    ['1', '11850378', 'G', 'A', 'DHCR7', 'NM_001360.2', 'missense', 
                     'c.445G>A', 'Pathogenic', 'AR', '0.9234'],
                    ['3', '51739482', 'C', 'T', 'MITF', 'NM_000248.3', 'missense',
                     'c.749C>T', 'Likely pathogenic', 'AD', '0.8712'],
                    ['7', '117171655', 'T', 'G', 'PAX4', 'NM_006193.2', 'missense',
                     'c.801T>G', 'Uncertain significance', 'AR', '0.7543'],
                    ['11', '11914993', 'A', 'G', 'SHOX', 'NM_000451.3', 'missense',
                     'c.457A>G', 'Likely benign', 'AD', '0.6821'],
                    ['17', '48275391', 'C', 'T', 'GENE', 'NM_005699.2', 'missense',
                     'c.1109C>T', 'Benign', 'AR', '0.4512'],
                ]
                for row in demo_data:
                    writer.writerow(row)
            
            # Parse CSV
            rows = parse_csv_to_rows(str(demo_csv))
            
            # Add ranking
            rows.sort(key=lambda x: float(x.get('seekrare_score', 0)), reverse=True)
            for i, row in enumerate(rows):
                row['rank'] = i + 1
            
            result = {
                "type": "complete",
                "session_id": session_id,
                "symptoms": symptoms,
                "stage1": {"total_variants": 1250},
                "csv_path": f"/api/results/{session_id}/candidates.csv",
                "csv_data": rows,
                "total_candidates": len(rows),
                "llm_interpretation": {
                    "relevant_hpos": [
                        {"hpo_id": "HP:0001249", "score": 0.95},
                        {"hpo_id": "HP:0002011", "score": 0.88},
                        {"hpo_id": "HP:0004325", "score": 0.72}
                    ],
                    "weight_vector": {"clinical": 0.4, "genomic": 0.35, "literature": 0.25}
                }
            }
            emit_sse_event(stream, "message", result)
            return
            
        # Real SeekRare analysis
        analyzer = RareDiseaseAnalyzer(
            llm_provider=os.getenv("LLM_PROVIDER", "openai"),
            llm_model=os.getenv("LLM_MODEL", "gpt-4o"),
            llm_api_key=os.getenv("LLM_API_KEY", ""),
            llm_base_url=os.getenv("LLM_BASE_URL"),
        )
        
        # Stage 1: VCF Preprocessing
        emit_sse_event(stream, "message", {
            "type": "progress",
            "stage": 1,
            "message": "VCF 预处理中..."
        })
        
        stage1_result = analyzer.stage1_preprocess(
            proband_vcf=proband_vcf,
            father_vcf=father_vcf,
            mother_vcf=mother_vcf,
        )
        
        # Stage 2: eQTL Annotation (optional)
        emit_sse_event(stream, "message", {
            "type": "progress",
            "stage": 2,
            "message": "eQTL 注释..."
        })
        
        stage2_result = analyzer.stage2_eqtl_annotate(stage1_result)
        
        # Stage 3: LLM Ranking
        emit_sse_event(stream, "message", {
            "type": "progress",
            "stage": 3,
            "message": "LLM 正在分析表型匹配..."
        })
        
        final_result = analyzer.stage3_rank_and_interpret(
            symptoms=symptoms,
            eqtl_annotated_vcf=stage2_result,
        )
        
        # Get CSV path
        csv_path = final_result.get("output_csv", "")
        if csv_path and os.path.exists(csv_path):
            rows = parse_csv_to_rows(csv_path)
        else:
            rows = []
        
        # Emit completion
        emit_sse_event(stream, "message", {
            "type": "complete",
            "session_id": session_id,
            "symptoms": symptoms,
            "stage1": {"total_variants": len(rows)},
            "csv_path": f"/api/results/{session_id}/candidates.csv",
            "csv_data": rows,
            "total_candidates": len(rows),
            "llm_interpretation": final_result.get("llm_interpretation", {})
        })
        
    except Exception as e:
        emit_sse_event(stream, "message", {
            "type": "error",
            "message": f"分析失败: {str(e)}"
        })


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "seekrare_available": SEEKrare_AVAILABLE,
        "version": "2.0.0"
    })


@app.route("/api/config", methods=["GET"])
def get_config():
    """Get server configuration"""
    return jsonify({
        "seekrare_available": SEEKrare_AVAILABLE,
        "max_file_size": "100MB",
        "supported_formats": [".vcf", ".vcf.gz"],
        "features": {
            "stage1_vcf_preprocess": True,
            "stage2_eqtl": True,
            "stage3_llm_ranking": True,
            "stage4_advanced_analysis": True
        }
    })


@app.route("/api/analyze", methods=["POST"])
def analyze_sync():
    """Synchronous analysis endpoint"""
    if "proband_vcf" not in request.files and "proband_vcf" not in request.form:
        return jsonify({"error": "Proband VCF file required"}), 400
    
    # Handle file upload
    session_id = str(uuid.uuid4())[:8]
    session_dir = WORK_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    
    proband_file = request.files.get("proband_vcf") or request.form.get("proband_vcf")
    if hasattr(proband_file, 'save'):
        proband_path = session_dir / sanitize_filename(proband_file.filename)
        proband_file.save(proband_path)
    else:
        proband_path = proband_file
    
    father_path = None
    mother_path = None
    
    if request.files.get("father_vcf"):
        father_file = request.files["father_vcf"]
        father_path = session_dir / sanitize_filename(father_file.filename)
        father_file.save(father_path)
    
    if request.files.get("mother_vcf"):
        mother_file = request.files["mother_vcf"]
        mother_path = session_dir / sanitize_filename(mother_file.filename)
        mother_file.save(mother_path)
    
    symptoms = request.form.get("symptoms", "")
    
    # Run analysis in thread
    result_container = {}
    
    def run():
        import io
        stream = io.BytesIO()
        
        def emit(event_type, data):
            result_container["result"] = data
        
        run_seekrare_analysis(
            session_id=session_id,
            symptoms=symptoms,
            proband_vcf=str(proband_path),
            father_vcf=str(father_path) if father_path else None,
            mother_vcf=str(mother_path) if mother_path else None,
            stream=stream
        )
    
    thread = threading.Thread(target=run)
    thread.start()
    thread.join(timeout=300)  # 5 min timeout
    
    if "result" in result_container:
        return jsonify(result_container["result"])
    else:
        return jsonify({"error": "Analysis timeout"}), 504


@app.route("/api/analyze/stream", methods=["POST"])
def analyze_stream():
    """Streaming analysis endpoint (SSE)"""
    if "proband_vcf" not in request.files and "proband_vcf" not in request.form:
        return jsonify({"error": "Proband VCF file required"}), 400
    
    # Handle file upload
    session_id = str(uuid.uuid4())[:8]
    session_dir = WORK_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    
    proband_file = request.files.get("proband_vcf")
    if proband_file:
        proband_path = session_dir / sanitize_filename(proband_file.filename)
        proband_file.save(proband_path)
    else:
        proband_path = request.form.get("proband_vcf")
    
    father_path = None
    mother_path = None
    
    if request.files.get("father_vcf"):
        father_file = request.files["father_vcf"]
        father_path = session_dir / sanitize_filename(father_file.filename)
        father_file.save(father_path)
    
    if request.files.get("mother_vcf"):
        mother_file = request.files["mother_vcf"]
        mother_path = session_dir / sanitize_filename(mother_file.filename)
        mother_file.save(mother_path)
    
    symptoms = request.form.get("symptoms", "")

    def generate():
        import io
        
        # Create a mock stream object for SSE
        class StreamBuffer:
            def __init__(self):
                self.buffer = io.BytesIO()
            
            def write(self, data):
                self.buffer.write(data)
            
            def flush(self):
                pass
            
            def getvalue(self):
                return self.buffer.getvalue().decode('utf-8')
        
        stream = StreamBuffer()
        
        # Run analysis
        run_seekrare_analysis(
            session_id=session_id,
            symptoms=symptoms,
            proband_vcf=str(proband_path),
            father_vcf=str(father_path) if father_path else None,
            mother_vcf=str(mother_path) if mother_path else None,
            stream=stream
        )
        
        # Parse and emit each line
        for line in stream.getvalue().split('\n'):
            if line.strip():
                yield line + '\n'

    return app.response_class(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )


@app.route("/api/advanced-analyze", methods=["POST"])
def advanced_analyze():
    """
    Advanced analysis endpoint (GENOS / AlphaFold3)
    
    Request body:
    {
        "session_id": "xxx",
        "selected_rows": [1, 2, 3],
        "analysis_type": "genos" | "alphafold",
        "csv_data": [...]
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    session_id = data.get("session_id", str(uuid.uuid4())[:8])
    selected_rows = data.get("selected_rows", [])
    analysis_type = data.get("analysis_type")
    csv_data = data.get("csv_data", [])
    
    if not analysis_type:
        return jsonify({"error": "analysis_type required (genos or alphafold)"}), 400
    
    if not selected_rows:
        return jsonify({"error": "selected_rows required"}), 400
    
    session_dir = RESULTS_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    
    results = []
    
    for row_id in selected_rows:
        # Find row data
        row = next((r for r in csv_data if r.get("id") == row_id), None)
        if not row:
            continue
        
        gene_name = row.get("gene_name", "Unknown")
        
        # Simulate advanced analysis
        # In real implementation, this would call:
        # - Genos致病位点扫描: seekrare.pipeline.RareDiseaseAnalyzer.stage4a_genos_analysis
        # - AlphaFold3: seekrare.pipeline.RareDiseaseAnalyzer.stage4b_alphafold_predict
        
        if analysis_type == "genos":
            # Generate simulated GENOS result image URL
            image_url = f"/api/results/{session_id}/genos_{gene_name}_{row_id}.png"
            
            # In real mode:
            # analyzer.stage4a_genos_analysis(variant_data)
            # image_url = f"/path/to/genos_result_{gene_name}.png"
            
            results.append({
                "id": row_id,
                "gene_name": gene_name,
                "analysis_type": "genos",
                "status": "completed",
                "image_url": image_url,
                "summary": f"Genos analysis completed for {gene_name}"
            })
            
        elif analysis_type == "alphafold":
            # Generate simulated AlphaFold3 result image URL
            image_url = f"/api/results/{session_id}/alphafold_{gene_name}_{row_id}.png"
            
            # In real mode:
            # analyzer.stage4b_alphafold_predict(variant_data)
            # image_url = f"/path/to/alphafold_result_{gene_name}.png"
            
            results.append({
                "id": row_id,
                "gene_name": gene_name,
                "analysis_type": "alphafold",
                "status": "completed",
                "image_url": image_url,
                "summary": f"AlphaFold3 prediction completed for {gene_name}"
            })
    
    return jsonify({
        "session_id": session_id,
        "analysis_type": analysis_type,
        "results": results,
        "total_processed": len(results)
    })


@app.route("/api/results/<session_id>/<filename>", methods=["GET"])
def serve_result(session_id: str, filename: str):
    """Serve result files"""
    # Security: prevent path traversal
    filename = sanitize_filename(filename)
    session_dir = WORK_DIR / session_id
    return send_from_directory(session_dir, filename)


@app.route("/api/results/<session_id>/<filename>")
def serve_advanced_result(session_id: str, filename: str):
    """Serve advanced analysis result files"""
    filename = sanitize_filename(filename)
    session_dir = RESULTS_DIR / session_id
    return send_from_directory(session_dir, filename)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    
    print(f"""
╔══════════════════════════════════════════════════════════╗
║                    SeekRare Web API                       ║
║                Rare Disease AI Diagnosis                 ║
╠══════════════════════════════════════════════════════════╣
║  Status: {'SeekRare Available' if SEEKrare_AVAILABLE else 'Demo Mode'}
║  Port: {port}
║  API: http://localhost:{port}/api
╚══════════════════════════════════════════════════════════╝
    """)
    
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
