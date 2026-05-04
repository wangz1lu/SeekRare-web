"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Upload,
  FileText,
  Activity,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";

interface CandidateVariant {
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

interface LLMInterpretation {
  relevant_hpos?: Array<{ hpo_id: string; score: number }>;
  weight_vector?: Record<string, number>;
}

interface AnalysisResult {
  session_id: string;
  symptoms: string;
  stage1?: {
    total_variants: number;
    columns: string[];
    sample: unknown[];
  };
  candidates: CandidateVariant[];
  total_candidates: number;
  llm_interpretation?: LLMInterpretation;
}

type AnalysisStatus = "idle" | "uploading" | "processing" | "complete" | "error";

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

  const handleFileChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<File | null>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setter(file);
      }
    },
    []
  );

  const analyzeVariants = async () => {
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
    setProgress(10);
    setProgressMessage("上传文件...");

    const formData = new FormData();
    formData.append("symptoms", symptoms);
    formData.append("proband_vcf", probandFile);
    if (fatherFile) formData.append("father_vcf", fatherFile);
    if (motherFile) formData.append("mother_vcf", motherFile);

    try {
      setStatus("processing");
      setProgress(30);
      setProgressMessage("正在连接分析服务...");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/analyze/stream`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应流");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      setProgress(50);
      setProgressMessage("正在分析变异...");

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
                  if (data.stage === 3) setProgress(60);
                  break;
                case "stage1_complete":
                  setProgress(70);
                  setProgressMessage(`发现 ${data.total_variants} 个变异位点`);
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
              // 忽略解析错误
            }
          }
        }
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "分析失败，请重试");
    }
  };

  const getClinvarBadgeVariant = (sig: string | undefined): "default" | "secondary" | "destructive" | "outline" => {
    if (!sig) return "outline";
    const lower = sig.toLowerCase();
    if (lower.includes("pathogenic") || lower.includes("likely pathogenic")) return "destructive";
    if (lower.includes("benign") || lower.includes("likely benign")) return "secondary";
    return "outline";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SeekRare</h1>
              <p className="text-xs text-muted-foreground">罕见病 AI 诊断平台</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* 左侧：输入区域 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 症状输入 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  患者症状
                </CardTitle>
                <CardDescription>
                  描述患者的临床表型和症状（支持中文）
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="例如：智力障碍，癫痫发作，全身肌张力低下，发育迟缓..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  症状描述越详细，诊断越准确
                </p>
              </CardContent>
            </Card>

            {/* VCF 文件上传 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  VCF 文件上传
                </CardTitle>
                <CardDescription>
                  上传家系基因组变异文件（支持 .vcf.gz 和 .vcf）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 先证者 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <span className="text-red-500">*</span> 先证者 VCF
                  </label>
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".vcf.gz,.vcf"
                      onChange={handleFileChange(setProbandFile)}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
                    />
                  </div>
                  {probandFile && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {probandFile.name}
                    </p>
                  )}
                </div>

                <Separator />

                {/* 父亲 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">父亲 VCF（可选）</label>
                  <Input
                    type="file"
                    accept=".vcf.gz,.vcf"
                    onChange={handleFileChange(setFatherFile)}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-50 file:text-slate-600 hover:file:bg-slate-100"
                  />
                  {fatherFile && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {fatherFile.name}
                    </p>
                  )}
                </div>

                {/* 母亲 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">母亲 VCF（可选）</label>
                  <Input
                    type="file"
                    accept=".vcf.gz,.vcf"
                    onChange={handleFileChange(setMotherFile)}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-50 file:text-slate-600 hover:file:bg-slate-100"
                  />
                  {motherFile && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {motherFile.name}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 开始分析按钮 */}
            <Button
              onClick={analyzeVariants}
              disabled={status === "processing" || status === "uploading"}
              className="w-full h-12 text-base"
              size="lg"
            >
              {status === "processing" || status === "uploading" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 mr-2" />
                  开始分析
                </>
              )}
            </Button>

            {/* 进度显示 */}
            {(status === "processing" || status === "uploading") && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{progressMessage}</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 错误显示 */}
            {error && (
              <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">分析失败</p>
                      <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* LLM 解释 */}
            {result?.llm_interpretation && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    LLM 症状解析
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.llm_interpretation.relevant_hpos && (
                    <div>
                      <p className="text-sm font-medium mb-2">相关 HPO 术语：</p>
                      <div className="flex flex-wrap gap-1">
                        {result.llm_interpretation.relevant_hpos.map((hpo, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {hpo.hpo_id} ({hpo.score.toFixed(2)})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.llm_interpretation.weight_vector && (
                    <div>
                      <p className="text-sm font-medium mb-2">权重向量：</p>
                      <div className="space-y-1">
                        {Object.entries(result.llm_interpretation.weight_vector).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{key}</span>
                            <span className="font-medium">{(value as number * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右侧：结果展示 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 分析状态 */}
            {status === "idle" && !result && (
              <Card className="min-h-[400px] flex items-center justify-center">
                <CardContent className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Activity className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">准备就绪</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    请在左侧输入患者症状描述并上传 VCF 文件，然后点击「开始分析」进行罕见病诊断
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 分析完成 */}
            {status === "complete" && result && (
              <>
                {/* 结果摘要 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      分析完成
                    </CardTitle>
                    <CardDescription>
                      Session ID: {result.session_id} | 共发现 {result.total_candidates} 个候选变异
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                        <p className="text-2xl font-bold text-blue-600">
                          {result.stage1?.total_variants || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">总变异数</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                        <p className="text-2xl font-bold text-green-600">
                          {result.total_candidates}
                        </p>
                        <p className="text-xs text-muted-foreground">候选变异</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                        <p className="text-2xl font-bold text-purple-600">
                          {new Set(result.candidates.map((c) => c.gene_name).filter(Boolean)).size}
                        </p>
                        <p className="text-xs text-muted-foreground">相关基因</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 症状回顾 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">输入症状</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{result.symptoms}</p>
                  </CardContent>
                </Card>

                {/* 候选变异列表 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>候选变异列表</span>
                      <Badge variant="outline">{result.total_candidates} 个</Badge>
                    </CardTitle>
                    <CardDescription>
                      基于表型匹配和变异评分的个性化排序结果
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">排名</TableHead>
                            <TableHead>基因</TableHead>
                            <TableHead>变异</TableHead>
                            <TableHead>遗传方式</TableHead>
                            <TableHead>ClinVar</TableHead>
                            <TableHead className="text-right">评分</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.candidates.map((variant, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Badge
                                  variant={index === 0 ? "default" : "secondary"}
                                  className={index === 0 ? "bg-blue-600" : ""}
                                >
                                  #{variant.rank || index + 1}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                {variant.gene_name || "-"}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {variant.CHROM && variant.POS
                                  ? `${variant.CHROM}:${variant.POS}`
                                  : "-"}
                                <br />
                                <span className="text-muted-foreground">
                                  {variant.REF} → {variant.ALT}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {variant.inheritance_type || "unknown"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getClinvarBadgeVariant(variant.clinvar_sig)}>
                                  {variant.clinvar_sig || "-"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-bold">
                                  {variant.seekrare_score?.toFixed(3) || "-"}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {result.candidates.length === 0 && (
                      <div className="text-center py-8">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-muted-foreground">未发现符合条件的高置信度候选变异</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* 底部说明 */}
        <Card className="mt-8">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">关于 SeekRare</p>
                <p>
                  SeekRare 是一个基于 LLM 的三阶段罕见病诊断系统。它通过分析患者的临床表型和基因组变异数据，
                  为医生提供个性化的候选变异排序结果，辅助罕见病基因诊断。
                </p>
                <p className="mt-2">
                  <strong>使用方法：</strong>输入患者的临床症状描述（如「智力障碍、癫痫、肌张力低下」），
                  上传患者的 VCF 基因组变异文件（建议同时上传父母的 VCF 以进行家系分析），
                  系统将自动分析并返回与症状相关的候选变异列表。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-6 bg-white/50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>SeekRare - 罕见病 AI 诊断平台 | 基于双动态评分算法的基因变异优先级分析</p>
          <p className="mt-1">Powered by Large Language Models</p>
        </div>
      </footer>
    </div>
  );
}
