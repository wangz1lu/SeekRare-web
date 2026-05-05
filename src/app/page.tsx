"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  FileText,
  Activity,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  Dna,
  Brain,
  Microscope,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Sparkles,
  FlaskConical,
  Layers,
} from "lucide-react";

interface VariantRow {
  id: number;
  CHROM?: string;
  POS?: number;
  REF?: string;
  ALT?: string;
  gene_name?: string;
  clinvar_sig?: string;
  inheritance_type?: string;
  seekrare_score?: number;
  rank?: number;
  [key: string]: unknown;
}

interface AnalysisResult {
  session_id: string;
  symptoms: string;
  stage1?: {
    total_variants: number;
  };
  csv_path: string;
  csv_data: VariantRow[];
  total_candidates: number;
  llm_interpretation?: {
    relevant_hpos?: Array<{ hpo_id: string; score: number }>;
    weight_vector?: Record<string, number>;
  };
}

type AnalysisStatus = "idle" | "uploading" | "processing" | "complete" | "error";

const DNA_COLORS = {
  primary: "#6366f1", // indigo
  secondary: "#8b5cf6", // violet
  accent: "#06b6d4", // cyan
  background: "#0f172a", // slate-900
  surface: "#1e293b", // slate-800
};

export default function SeekRarePage() {
  const [symptoms, setSymptoms] = useState("");
  const [probandFile, setProbandFile] = useState<File | null>(null);
  const [fatherFile, setFatherFile] = useState<File | null>(null);
  const [motherFile, setMotherFile] = useState<File | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showAdvancedDialog, setShowAdvancedDialog] = useState(false);
  const [advancedAnalysisType, setAdvancedAnalysisType] = useState<"genos" | "alphafold" | null>(null);
  const [advancedProcessing, setAdvancedProcessing] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [imageModal, setImageModal] = useState<{ open: boolean; src: string; title: string }>({
    open: false,
    src: "",
    title: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<File | null>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setter(file);
    },
    []
  );

  const toggleRowSelection = useCallback((id: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!result) return;
    if (selectedRows.size === result.csv_data.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(result.csv_data.map((r) => r.id)));
    }
  }, [result, selectedRows]);

  const startAnalysis = async () => {
    if (!symptoms.trim()) {
      setError("请输入患者症状描述");
      return;
    }
    if (!probandFile) {
      setError("请上传先证者 VCF 文件");
      return;
    }

    setError(null);
    setStatus("uploading");
    setProgress(5);
    setProgressMessage("准备上传...");

    const formData = new FormData();
    formData.append("symptoms", symptoms);
    formData.append("proband_vcf", probandFile);
    if (fatherFile) formData.append("father_vcf", fatherFile);
    if (motherFile) formData.append("mother_vcf", motherFile);

    try {
      setStatus("processing");
      setProgress(15);
      setProgressMessage("上传文件至服务器...");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/analyze/stream`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`请求失败: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

      setProgress(30);
      setProgressMessage("服务器正在分析 VCF 文件...");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case "progress":
                  setProgressMessage(data.message);
                  if (data.stage === 1) setProgress(40);
                  if (data.stage === 2) setProgress(55);
                  if (data.stage === 3) setProgress(70);
                  break;
                case "stage_complete":
                  setProgress(85);
                  setProgressMessage("LLM 正在生成排序结果...");
                  break;
                case "complete":
                  setProgress(100);
                  setStatus("complete");
                  setResult(data);
                  break;
                case "error":
                  setStatus("error");
                  setError(data.message);
                  break;
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "分析失败，请重试");
    }
  };

  const runAdvancedAnalysis = async () => {
    if (selectedRows.size === 0) {
      setError("请先选择要分析的变异位点");
      return;
    }
    if (!advancedAnalysisType) {
      setError("请选择分析类型");
      return;
    }

    setAdvancedProcessing(true);
    setShowAdvancedDialog(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/advanced-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: result?.session_id,
          selected_rows: Array.from(selectedRows),
          analysis_type: advancedAnalysisType,
          csv_data: result?.csv_data.filter((r) => selectedRows.has(r.id)),
        }),
      });

      if (!response.ok) throw new Error("高级分析请求失败");

      const data = await response.json();
      
      // 更新结果，添加图片链接
      if (result && data.results) {
        const updatedData = result.csv_data.map((row) => {
          const analysisResult = data.results.find(
            (r: { id: number }) => r.id === row.id
          );
          if (analysisResult) {
            return {
              ...row,
              genos_image: analysisResult.genos_image,
              alphafold_image: analysisResult.alphafold_image,
            };
          }
          return row;
        });
        setResult({ ...result, csv_data: updatedData });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "高级分析失败");
    } finally {
      setAdvancedProcessing(false);
      setSelectedRows(new Set());
    }
  };

  const getClinvarBadgeVariant = (
    sig: string | undefined
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (!sig) return "outline";
    const lower = sig.toLowerCase();
    if (lower.includes("pathogenic") || lower.includes("likely pathogenic"))
      return "destructive";
    if (lower.includes("benign") || lower.includes("likely benign"))
      return "secondary";
    return "outline";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Dna className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-xl blur opacity-30 -z-10" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-indigo-200 to-cyan-200 bg-clip-text text-transparent">
                  SeekRare
                </h1>
                <p className="text-xs text-slate-400">罕见病 AI 诊断平台</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                <Sparkles className="w-3 h-3 mr-1" />
                LLM Powered
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {status === "idle" && !result && (
          /* ===== Input Phase ===== */
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left: Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Hero Card */}
              <Card className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    智能诊断
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    输入患者症状，系统自动分析基因组变异
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <span className="text-cyan-400 font-bold text-sm">1</span>
                      </div>
                      <span className="text-sm text-slate-300">输入临床表型描述</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <span className="text-cyan-400 font-bold text-sm">2</span>
                      </div>
                      <span className="text-sm text-slate-300">上传基因组变异文件</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <span className="text-cyan-400 font-bold text-sm">3</span>
                      </div>
                      <span className="text-sm text-slate-300">获取 AI 排序结果</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Symptoms Input */}
              <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    患者症状描述
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    描述患者的临床表型（支持中文）
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="例如：智力障碍，癫痫发作，全身肌张力低下，发育迟缓，视网膜色素变性..."
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    rows={4}
                    className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500 resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    症状描述越详细，诊断越准确
                  </p>
                </CardContent>
              </Card>

              {/* VCF Upload */}
              <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Upload className="w-5 h-5 text-cyan-400" />
                    VCF 文件上传
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    支持 .vcf.gz 和 .vcf 格式
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <span className="text-red-400">*</span> 先证者 VCF
                    </label>
                    <div
                      className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-500/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".vcf.gz,.vcf"
                        onChange={handleFileChange(setProbandFile)}
                        className="hidden"
                      />
                      {probandFile ? (
                        <div className="flex items-center justify-center gap-2 text-green-400">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="text-sm">{probandFile.name}</span>
                        </div>
                      ) : (
                        <div className="text-slate-400">
                          <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">点击或拖拽上传</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-slate-700/50" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-400">
                        父亲 VCF（可选）
                      </label>
                      <Input
                        type="file"
                        accept=".vcf.gz,.vcf"
                        onChange={handleFileChange(setFatherFile)}
                        className="bg-slate-800/50 border-slate-600/50"
                      />
                      {fatherFile && (
                        <p className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {fatherFile.name}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-400">
                        母亲 VCF（可选）
                      </label>
                      <Input
                        type="file"
                        accept=".vcf.gz,.vcf"
                        onChange={handleFileChange(setMotherFile)}
                        className="bg-slate-800/50 border-slate-600/50"
                      />
                      {motherFile && (
                        <p className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {motherFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Error Alert */}
              {error && (
                <Alert className="bg-red-900/20 border-red-500/30 text-red-300">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                onClick={startAnalysis}
                disabled={status !== "idle"}
                className="w-full h-14 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25"
              >
                {status !== "idle" ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Activity className="w-5 h-5 mr-2" />
                    开始分析
                  </>
                )}
              </Button>

              {/* Progress */}
              {status !== "idle" && (
                <Card className="bg-slate-900/60 border-slate-700/50">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">{progressMessage}</span>
                        <span className="text-indigo-400 font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2 bg-slate-700" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right: Info */}
            <div className="lg:col-span-3 space-y-6">
              <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-slate-700/50 h-full">
                <CardContent className="pt-12">
                  <div className="text-center py-12">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 flex items-center justify-center">
                      <Dna className="w-12 h-12 text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">
                      三阶段 AI 诊断
                    </h2>
                    <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                      <div className="p-4 rounded-xl bg-white/5">
                        <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                          <Layers className="w-5 h-5 text-indigo-400" />
                        </div>
                        <p className="text-xs text-slate-400">Stage 1</p>
                        <p className="text-sm font-medium text-white">VCF 预处理</p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5">
                        <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-purple-500/20 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-purple-400" />
                        </div>
                        <p className="text-xs text-slate-400">Stage 3</p>
                        <p className="text-sm font-medium text-white">LLM 排序</p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5">
                        <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                          <Microscope className="w-5 h-5 text-cyan-400" />
                        </div>
                        <p className="text-xs text-slate-400">Stage 4</p>
                        <p className="text-sm font-medium text-white">深度分析</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {status === "complete" && result && (
          /* ===== Results Phase ===== */
          <div className="space-y-6">
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">分析结果</h2>
                <p className="text-slate-400">
                  Session: {result.session_id} | 共 {result.total_candidates} 个候选变异
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setStatus("idle");
                    setSelectedRows(new Set());
                  }}
                  className="border-slate-600 text-slate-300"
                >
                  新分析
                </Button>
                <Button
                  onClick={() => setShowAdvancedDialog(true)}
                  disabled={selectedRows.size === 0 || advancedProcessing}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                >
                  {advancedProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <FlaskConical className="w-4 h-4 mr-2" />
                      高级分析 ({selectedRows.size})
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Symptoms Summary */}
            <Card className="bg-slate-900/60 border-slate-700/50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-indigo-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-300 mb-1">输入症状</p>
                    <p className="text-slate-400">{result.symptoms}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* LLM Interpretation */}
            {result.llm_interpretation && (
              <Card className="bg-slate-900/60 border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    LLM 症状解析
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.llm_interpretation.relevant_hpos?.map((hpo, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="bg-purple-500/10 text-purple-300 border-purple-500/30"
                      >
                        {hpo.hpo_id}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results Table */}
            <Card className="bg-slate-900/60 border-slate-700/50 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">候选变异列表</CardTitle>
                <CardDescription className="text-slate-400">
                  基于表型匹配的个性化排序 | 勾选行后可执行高级分析
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700/50 hover:bg-transparent">
                        <TableHead className="w-12 bg-slate-800/50">
                          <Checkbox
                            checked={selectedRows.size === result.csv_data.length && result.csv_data.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="bg-slate-800/50">排名</TableHead>
                        <TableHead className="bg-slate-800/50">基因</TableHead>
                        <TableHead className="bg-slate-800/50">变异</TableHead>
                        <TableHead className="bg-slate-800/50">遗传方式</TableHead>
                        <TableHead className="bg-slate-800/50">ClinVar</TableHead>
                        <TableHead className="bg-slate-800/50 text-right">评分</TableHead>
                        <TableHead className="bg-slate-800/50">GENOS</TableHead>
                        <TableHead className="bg-slate-800/50">AlphaFold3</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.csv_data.map((variant) => (
                        <>
                          <TableRow
                            key={variant.id}
                            className={`border-slate-700/30 hover:bg-slate-800/30 ${
                              selectedRows.has(variant.id) ? "bg-indigo-500/10" : ""
                            }`}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedRows.has(variant.id)}
                                onCheckedChange={() => toggleRowSelection(variant.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={variant.rank === 1 ? "default" : "secondary"}
                                className={
                                  variant.rank === 1
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                    : "bg-slate-700"
                                }
                              >
                                #{variant.rank || variant.id}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-white">
                              {variant.gene_name || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-xs">
                                <span className="text-slate-400">
                                  {variant.CHROM}:{variant.POS}
                                </span>
                                <br />
                                <span className="text-indigo-300">
                                  {variant.REF} → {variant.ALT}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {variant.inheritance_type || "unknown"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={getClinvarBadgeVariant(variant.clinvar_sig)}
                                className="text-xs"
                              >
                                {variant.clinvar_sig || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-bold text-indigo-400">
                                {variant.seekrare_score?.toFixed(4) || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {(variant as Record<string, unknown>).genos_image ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setImageModal({
                                      open: true,
                                      src: String((variant as Record<string, unknown>).genos_image),
                                      title: `GENOS Analysis - ${variant.gene_name || "Variant"}`,
                                    })
                                  }
                                  className="text-cyan-400 hover:text-cyan-300"
                                >
                                  <ImageIcon className="w-4 h-4" />
                                </Button>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {(variant as Record<string, unknown>).alphafold_image ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setImageModal({
                                      open: true,
                                      src: String((variant as Record<string, unknown>).alphafold_image),
                                      title: `AlphaFold3 - ${variant.gene_name || "Variant"}`,
                                    })
                                  }
                                  className="text-cyan-400 hover:text-cyan-300"
                                >
                                  <ImageIcon className="w-4 h-4" />
                                </Button>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <Card className="bg-red-900/20 border-red-500/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <XCircle className="w-10 h-10 text-red-400" />
                <div>
                  <h3 className="text-lg font-medium text-red-300">分析失败</h3>
                  <p className="text-red-400/80 mt-1">{error}</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatus("idle");
                      setError(null);
                    }}
                    className="mt-4 border-red-500/30 text-red-300"
                  >
                    重试
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Advanced Analysis Dialog */}
      <Dialog open={showAdvancedDialog} onOpenChange={setShowAdvancedDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-cyan-400" />
              选择高级分析模块
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              已选择 {selectedRows.size} 个变异位点，请选择分析类型：
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setAdvancedAnalysisType("genos")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  advancedAnalysisType === "genos"
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-600 hover:border-slate-500"
                }`}
              >
                <Microscope className={`w-8 h-8 mx-auto mb-2 ${
                  advancedAnalysisType === "genos" ? "text-cyan-400" : "text-slate-400"
                }`} />
                <p className="font-medium text-white">GENOS 致病位点扫描</p>
                <p className="text-xs text-slate-400 mt-1">Genos 模型深度分析</p>
              </button>
              <button
                onClick={() => setAdvancedAnalysisType("alphafold")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  advancedAnalysisType === "alphafold"
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-slate-600 hover:border-slate-500"
                }`}
              >
                <Dna className={`w-8 h-8 mx-auto mb-2 ${
                  advancedAnalysisType === "alphafold" ? "text-purple-400" : "text-slate-400"
                }`} />
                <p className="font-medium text-white">AlphaFold3 结构预测</p>
                <p className="text-xs text-slate-400 mt-1">蛋白质三维结构分析</p>
              </button>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowAdvancedDialog(false)}
                className="border-slate-600 text-slate-300"
              >
                取消
              </Button>
              <Button
                onClick={runAdvancedAnalysis}
                disabled={!advancedAnalysisType}
                className="bg-gradient-to-r from-cyan-600 to-purple-600"
              >
                开始分析
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog open={imageModal.open} onOpenChange={(open) => setImageModal({ ...imageModal, open })}>
        <DialogContent className="max-w-4xl bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">{imageModal.title}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {imageModal.src && (
              <img
                src={imageModal.src}
                alt={imageModal.title}
                className="max-w-full max-h-[70vh] rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 mt-16 py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">
            SeekRare - 罕见病 AI 诊断平台 | 基于双动态评分算法的基因变异优先级分析
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Powered by Large Language Models
          </p>
        </div>
      </footer>
    </div>
  );
}
