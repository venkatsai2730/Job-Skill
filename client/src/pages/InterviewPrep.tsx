import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, BookOpen, Send, Award, CheckCircle2,
  AlertTriangle, Filter, ChevronRight, HelpCircle,
  Building, RefreshCw, Copy, Check
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";

interface QuestionItem {
  id: string;
  category: string;
  title: string;
  company: string;
  difficulty: string;
  question: string;
  concepts: string[];
  starTip: string;
}

interface EvaluationResult {
  score: number;
  verdict: string;
  strengths: string[];
  areasForImprovement: string[];
  starBreakdown: {
    situation: string;
    action: string;
    result: string;
  };
  modelAnswer: string;
}

export default function InterviewPrep() {
  const [searchParams] = useSearchParams();
  const initialCompany = searchParams.get("company") || "";
  const initialRole = searchParams.get("role") || "";

  const [activeTab, setActiveTab] = useState<"bank" | "predict">("bank");

  // Question Bank State
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loadingBank, setLoadingBank] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedCompany, setSelectedCompany] = useState<string>(initialCompany || "All");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("All");

  // Interactive Practice State
  const [activeQuestion, setActiveQuestion] = useState<QuestionItem | null>(null);
  const [userPracticeAnswer, setUserPracticeAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  // Resume Predict Tab State
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState(initialRole || "");
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictedCategories, setPredictedCategories] = useState<any[]>([]);

  useEffect(() => {
    fetchQuestionBank();
  }, [selectedCategory, selectedCompany, selectedDifficulty]);

  const fetchQuestionBank = async () => {
    try {
      setLoadingBank(true);
      const params = new URLSearchParams();
      if (selectedCategory !== "All") params.append("category", selectedCategory);
      if (selectedCompany !== "All") params.append("company", selectedCompany);
      if (selectedDifficulty !== "All") params.append("difficulty", selectedDifficulty);

      const res = await api.get<{ questions: QuestionItem[] }>(`/api/interview/question-bank?${params.toString()}`);
      setQuestions(res.questions || []);
    } catch (err) {
      console.error("Failed to fetch questions:", err);
    } finally {
      setLoadingBank(false);
    }
  };

  const handleStartPractice = (q: QuestionItem) => {
    setActiveQuestion(q);
    setUserPracticeAnswer("");
    setEvaluation(null);
  };

  const handleEvaluateAnswer = async () => {
    if (!activeQuestion || !userPracticeAnswer.trim()) return;

    try {
      setIsEvaluating(true);
      const res = await api.post<{ success: boolean; evaluation: EvaluationResult }>("/api/interview/evaluate-answer", {
        question: activeQuestion.question,
        category: activeQuestion.category,
        company: activeQuestion.company,
        role: targetRole || "Software Engineer",
        userAnswer: userPracticeAnswer,
      });
      setEvaluation(res.evaluation);
    } catch (err: any) {
      alert(err.message || "Failed to evaluate answer");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handlePredictQuestions = async () => {
    try {
      setIsPredicting(true);
      const res = await api.post<{ categories: any[] }>("/api/interview/predict-interview-questions", {
        jobDescription: jobDescription || `Target Role: ${targetRole || "Software Engineer"}`,
      });
      setPredictedCategories(res.categories || []);
    } catch (err: any) {
      alert(err.message || "Failed to predict questions");
    } finally {
      setIsPredicting(false);
    }
  };

  const handleCopyModelAnswer = () => {
    if (!evaluation?.modelAnswer) return;
    navigator.clipboard.writeText(evaluation.modelAnswer);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 2000);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Interview Prep Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
              AI Powered
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real FAANG question bank, STAR framework scoring, and AI question prediction tailored to your resume.
          </p>
        </div>

        {/* TABS */}
        <div className="flex bg-muted/60 p-1 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab("bank")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "bank"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Question Bank</span>
          </button>
          <button
            onClick={() => setActiveTab("predict")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "predict"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Predict for My JD</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: QUESTION BANK */}
      {activeTab === "bank" && (
        <div className="space-y-6">
          {/* FILTERS */}
          <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                <Filter className="w-3.5 h-3.5" /> Filter by:
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none"
              >
                <option value="All">All Categories</option>
                <option value="System Design">System Design</option>
                <option value="Behavioral">Behavioral (STAR)</option>
                <option value="Coding & DSA">Coding & DSA</option>
                <option value="Leadership & Culture">Leadership & Culture</option>
              </select>

              {/* Company Filter */}
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none"
              >
                <option value="All">All Companies</option>
                <option value="Google">Google</option>
                <option value="Amazon">Amazon</option>
                <option value="Meta">Meta</option>
                <option value="Microsoft">Microsoft</option>
                <option value="Apple">Apple</option>
                <option value="Stripe">Stripe</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Netflix">Netflix</option>
                <option value="Uber">Uber</option>
              </select>

              {/* Difficulty Filter */}
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none"
              >
                <option value="All">All Difficulties</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <span className="text-xs text-muted-foreground">
              Showing <strong>{questions.length}</strong> vetted interview questions
            </span>
          </div>

          {/* MAIN GRID & PRACTICE DRAWER */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left list of questions */}
            <div className={`${activeQuestion ? "lg:col-span-6" : "lg:col-span-12"} space-y-4`}>
              {loadingBank ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                </div>
              ) : questions.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                  No questions match the selected filter criteria.
                </div>
              ) : (
                questions.map((q) => {
                  const isSelected = activeQuestion?.id === q.id;
                  return (
                    <motion.div
                      key={q.id}
                      layout
                      onClick={() => handleStartPractice(q)}
                      className={`bg-card border rounded-xl p-5 cursor-pointer transition-all ${
                        isSelected
                          ? "border-purple-500 ring-1 ring-purple-500/50 shadow-md shadow-purple-500/10"
                          : "border-border hover:border-purple-500/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400">
                            {q.category}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                            <Building className="w-3 h-3" /> {q.company}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            q.difficulty === "Hard"
                              ? "bg-rose-500/10 text-rose-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-foreground mb-1.5">{q.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{q.question}</p>

                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {q.concepts.map((concept, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground"
                          >
                            #{concept}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60 text-xs">
                        <span className="text-purple-400 font-medium flex items-center gap-1">
                          ⚡ Click to practice & get AI evaluation <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Right Practice Sandbox Drawer */}
            {activeQuestion && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="lg:col-span-6 bg-card border border-border rounded-2xl p-6 sticky top-20 shadow-xl space-y-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                      Practice Arena • {activeQuestion.company}
                    </span>
                    <h3 className="text-lg font-bold text-foreground mt-0.5">{activeQuestion.title}</h3>
                  </div>
                  <button
                    onClick={() => setActiveQuestion(null)}
                    className="text-muted-foreground hover:text-foreground text-sm font-semibold"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-muted/40 p-3.5 rounded-xl border border-border text-sm text-foreground">
                  <p className="font-medium">{activeQuestion.question}</p>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    💡 Tip: {activeQuestion.starTip}
                  </p>
                </div>

                {/* Answer Text Area */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Your Response (Type as if answering live):
                  </label>
                  <textarea
                    rows={6}
                    value={userPracticeAnswer}
                    onChange={(e) => setUserPracticeAnswer(e.target.value)}
                    placeholder="In my previous project at..., we noticed latency spikes during high volume. I investigated the root cause and decided to..."
                    className="w-full p-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-vertical"
                  />
                </div>

                <button
                  onClick={handleEvaluateAnswer}
                  disabled={isEvaluating || userPracticeAnswer.trim().length < 15}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-md shadow-purple-500/20"
                >
                  {isEvaluating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Evaluating with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Evaluate My Answer with AI
                    </>
                  )}
                </button>

                {/* AI EVALUATION REPORT */}
                {evaluation && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-purple-500/30 bg-purple-500/5 rounded-xl p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-border/60">
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                          Interviewer Verdict
                        </span>
                        <p className="text-base font-bold text-foreground">{evaluation.verdict}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-purple-400 font-mono">
                          {evaluation.score}/100
                        </span>
                        <span className="block text-[10px] text-muted-foreground uppercase">Overall Score</span>
                      </div>
                    </div>

                    {/* Strengths & Improvements */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-background/80 p-3 rounded-lg border border-border">
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mb-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
                        </span>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {evaluation.strengths.map((s, idx) => (
                            <li key={idx}>• {s}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-background/80 p-3 rounded-lg border border-border">
                        <span className="text-xs font-semibold text-amber-400 flex items-center gap-1 mb-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> Actionable Fixes
                        </span>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {evaluation.areasForImprovement.map((a, idx) => (
                            <li key={idx}>• {a}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Model Answer */}
                    <div className="bg-background p-3.5 rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-purple-400" /> Top 1% Model Answer:
                        </span>
                        <button
                          onClick={handleCopyModelAnswer}
                          className="text-xs text-muted-foreground hover:text-purple-400 flex items-center gap-1"
                        >
                          {copiedAnswer ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedAnswer ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed italic">
                        "{evaluation.modelAnswer}"
                      </p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: PREDICT QUESTIONS FROM JD */}
      {activeTab === "predict" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Predict Interview Questions for Target Role
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Paste the Job Description from any job board. Our AI reads your active resume and predicts the highest-probability questions the interview committee will ask.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Target Role</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Backend Engineer"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Job Description Text (paste requirements & responsibilities)
              </label>
              <textarea
                rows={5}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job posting text here..."
                className="w-full p-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-vertical"
              />
            </div>

            <button
              onClick={handlePredictQuestions}
              disabled={isPredicting || (!jobDescription.trim() && !targetRole.trim())}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-md shadow-purple-500/20"
            >
              {isPredicting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Analyzing Resume & JD...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Predict Tailored Questions
                </>
              )}
            </button>
          </div>

          {/* PREDICTED RESULTS */}
          {predictedCategories.length > 0 && (
            <div className="space-y-6">
              {predictedCategories.map((cat, idx) => (
                <div key={idx} className="bg-card border border-border rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                    <h3 className="font-bold text-base text-foreground">{cat.title || cat.name}</h3>
                  </div>

                  <div className="space-y-3">
                    {(cat.questions || []).map((qObj: any, qIdx: number) => (
                      <div
                        key={qIdx}
                        className="bg-background border border-border/80 rounded-xl p-4 space-y-2 hover:border-purple-500/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-sm text-foreground">
                            {qIdx + 1}. {qObj.question}
                          </p>
                          {qObj.skill && (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-purple-500/10 text-purple-400 font-mono shrink-0">
                              {qObj.skill}
                            </span>
                          )}
                        </div>

                        {qObj.suggestedAnswer && (
                          <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50 text-xs text-muted-foreground mt-2">
                            <span className="font-semibold text-foreground block mb-0.5">Recommended Strategy:</span>
                            {qObj.suggestedAnswer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
