import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Rocket, 
  Sword, 
  Building, 
  Music, 
  Briefcase, 
  Shield, 
  Coffee, 
  Film, 
  Sparkles, 
  RotateCcw, 
  Trophy, 
  Flame, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Share2,
  Search, 
  Home, 
  BookOpen,
  HelpCircle,
  TrendingUp,
  BrainCircuit
} from "lucide-react";
import { TriviaQuestion, HistoryItem } from "./types";
import { PRELOADED_CATEGORIES, DIFFICULTY_DESCRIPTIONS } from "./data";

export default function App() {
  // Game Machine States
  const [gameState, setGameState] = useState<"category-select" | "loading" | "playing" | "results">("category-select");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState<"warm-up" | "fan" | "obsessive" | "scholar">("fan");
  const [customCategory, setCustomCategory] = useState("");
  
  // Quiz states
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ selectedIndex: number; correctIndex: number; isCorrect: boolean }[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // Loading/Error states
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Filtering surface-level facts...");
  const [error, setError] = useState<{ type: string; message: string; suggestion?: string } | null>(null);

  // Stats State (Persisted in localStorage)
  const [streak, setStreak] = useState(0);
  const [highStreak, setHighStreak] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<HistoryItem[]>([]);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);

  // Expandable breakdown item for results screen
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Local Storage Persistence
  useEffect(() => {
    const savedHighStreak = localStorage.getItem("niche_trivia_high_streak");
    const savedTotalAnswered = localStorage.getItem("niche_trivia_total_answered");
    const savedTotalCorrect = localStorage.getItem("niche_trivia_total_correct");
    const savedHistory = localStorage.getItem("niche_trivia_history");

    if (savedHighStreak) setHighStreak(parseInt(savedHighStreak, 10));
    if (savedTotalAnswered) setTotalAnswered(parseInt(savedTotalAnswered, 10));
    if (savedTotalCorrect) setTotalCorrect(parseInt(savedTotalCorrect, 10));
    if (savedHistory) setSessionHistory(JSON.parse(savedHistory));
  }, []);

  // Cycling witty loading messages
  useEffect(() => {
    if (gameState !== "loading") return;
    const messages = [
      "Consulting verified niche archives...",
      "Weaving plausible distractions...",
      "Calibrating obsessive-level details...",
      "Filtering out surface-level facts...",
      "Fact-checking dates and primary sources...",
      "Ensuring no accidental trickery...",
      "Polishing the intellectual payoff..."
    ];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setLoadingText(messages[index]);
    }, 1200);
    return () => clearInterval(interval);
  }, [gameState]);

  // Helper to map string category icons to Lucide components safely
  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case "Rocket": return <Rocket className="w-5 h-5 text-indigo-400" />;
      case "Sword": return <Sword className="w-5 h-5 text-amber-400" />;
      case "Building": return <Building className="w-5 h-5 text-emerald-400" />;
      case "Music": return <Music className="w-5 h-5 text-pink-400" />;
      case "Briefcase": return <Briefcase className="w-5 h-5 text-sky-400" />;
      case "Shield": return <Shield className="w-5 h-5 text-rose-400" />;
      case "Coffee": return <Coffee className="w-5 h-5 text-amber-600" />;
      case "Film": return <Film className="w-5 h-5 text-violet-400" />;
      default: return <Sparkles className="w-5 h-5 text-indigo-400" />;
    }
  };

  // Initial fetch for a 10-question round (all upfront, no loading between questions)
  const fetchQuestions = async (targetCategory: string) => {
    setGameState("loading");
    setLoadingText("Generating your trivia...");
    setError(null);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);

    const delays = [1000, 2000, 4000, 8000];
    const maxRetries = 4;
    let attempt = 0;

    const executeFetch = async (): Promise<boolean> => {
      try {
        const response = await fetch("/api/trivia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: targetCategory,
            difficulty,
            previousQuestions: previousQuestions
          }),
        });

        let data;
        try {
          data = await response.json();
        } catch (jsonErr) {
          throw new Error("malformed_json");
        }

        if (!response.ok) {
          throw new Error(data.message || `Server status ${response.status}`);
        }

        if (data.error === "category_unusable" || data.error === "category_too_narrow") {
          setError({
            type: "category_unusable",
            message: data.reason || `The topic "${targetCategory}" is unusable or too private for verified trivia generation.`,
            suggestion: data.suggestion
          });
          setQuestions([]);
          setGameState("category-select");
          return true; // Stop retrying, refusal is expected
        }

        if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
          throw new Error("malformed_json");
        }

        // Validate each question structure roughly
        const validQs = data.questions.filter((q: any) => 
          q && typeof q.question === "string" && Array.isArray(q.options) && q.options.length === 4
        );

        if (validQs.length === 0) {
          throw new Error("malformed_json");
        }

        // Successfully generated 10 questions
        setQuestions(validQs);
        setCategory(targetCategory);
        setGameState("playing");

        // Record the question texts in previousQuestions so we avoid them next time
        const newTexts = validQs.map((q: any) => q.question);
        setPreviousQuestions(prev => {
          const updated = [...prev];
          newTexts.forEach((text: string) => {
            if (!updated.includes(text)) {
              updated.push(text);
            }
          });
          return updated;
        });

        return true;
      } catch (err: any) {
        if (err.message === "malformed_json") {
          setLoadingText("Formatting issue, retrying generation...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempt++;
        }

        if (attempt < maxRetries) {
          const delay = delays[attempt] || 1000;
          attempt++;
          setLoadingText(`Server busy, retrying... (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return await executeFetch();
        }

        setError({
          type: "server_error",
          message: "Hmm, that didn't work. Try again in a sec."
        });
        setQuestions([]);
        setGameState("category-select");
        return false;
      }
    };

    await executeFetch();
  };

  const handleStartGame = (selectedCat: string) => {
    if (!selectedCat.trim()) return;
    fetchQuestions(selectedCat.trim());
  };

  const handleSelectAnswer = (optionIdx: number) => {
    if (selectedAnswer !== null || questions.length === 0) return;
    
    const currentQ = questions[currentQuestionIndex];
    const isCorrect = optionIdx === currentQ.answer_index;
    setSelectedAnswer(optionIdx);

    // Save answer
    const newAnswer = {
      selectedIndex: optionIdx,
      correctIndex: currentQ.answer_index,
      isCorrect
    };
    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    // Calculate score & stats
    const nextStreak = isCorrect ? streak + 1 : 0;
    const nextHighStreak = Math.max(highStreak, nextStreak);
    setStreak(nextStreak);
    setHighStreak(nextHighStreak);
    localStorage.setItem("niche_trivia_high_streak", nextHighStreak.toString());
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // End of round! Save history and proceed to results
      const finalScore = answers.filter(a => a.isCorrect).length;
      const nextTotalAnswered = totalAnswered + questions.length;
      const nextTotalCorrect = totalCorrect + finalScore;

      setTotalAnswered(nextTotalAnswered);
      setTotalCorrect(nextTotalCorrect);

      localStorage.setItem("niche_trivia_total_answered", nextTotalAnswered.toString());
      localStorage.setItem("niche_trivia_total_correct", nextTotalCorrect.toString());

      // Save category history
      const existingHistoryIdx = sessionHistory.findIndex(h => h.category.toLowerCase() === category.toLowerCase() && h.difficulty === difficulty);
      let updatedHistory = [...sessionHistory];

      if (existingHistoryIdx > -1) {
        updatedHistory[existingHistoryIdx].score += finalScore;
        updatedHistory[existingHistoryIdx].total += questions.length;
        updatedHistory[existingHistoryIdx].date = new Date().toLocaleDateString();
      } else {
        updatedHistory.unshift({
          id: Math.random().toString(36).substring(2, 11),
          category,
          difficulty,
          score: finalScore,
          total: questions.length,
          date: new Date().toLocaleDateString()
        });
      }

      setSessionHistory(updatedHistory);
      localStorage.setItem("niche_trivia_history", JSON.stringify(updatedHistory));

      setGameState("results");
    }
  };

  const handleQuitToMenu = () => {
    setGameState("category-select");
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setError(null);
    setStreak(0);
  };

  const handleResetStats = () => {
    if (confirm("Are you sure you want to clear your high streak and gameplay history?")) {
      localStorage.clear();
      setStreak(0);
      setHighStreak(0);
      setTotalAnswered(0);
      setTotalCorrect(0);
      setSessionHistory([]);
      setPreviousQuestions([]);
      setQuestions([]);
      setAnswers([]);
      setGameState("category-select");
    }
  };

  const handleShareResult = () => {
    const finalScore = answers.filter(a => a.isCorrect).length;
    const rating = finalScore >= 9 ? "SCHOLAR" :
                   finalScore >= 7 ? "OBSESSED" :
                   finalScore >= 5 ? "FAN" :
                   finalScore >= 3 ? "CASUAL" : "TOURIST";
    
    const textSnippet = `I scored ${finalScore}/10 on ${category} trivia. Status: ${rating}.`;
    navigator.clipboard.writeText(textSnippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getVerdict = (score: number) => {
    if (score >= 9) return { text: "STATUS: SCHOLAR", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" };
    if (score >= 7) return { text: "STATUS: OBSESSED", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/5" };
    if (score >= 5) return { text: "STATUS: FAN", color: "text-amber-400 border-amber-500/30 bg-amber-500/5" };
    if (score >= 3) return { text: "STATUS: CASUAL", color: "text-slate-400 border-slate-700 bg-slate-900/30" };
    return { text: "STATUS: TOURIST", color: "text-rose-400 border-rose-500/30 bg-rose-500/5" };
  };

  // Modern top bar rendering for current rounds
  const renderProgressBarAndSquares = () => {
    const currentNum = currentQuestionIndex + 1;
    return (
      <div className="flex flex-col gap-2 w-full border-b border-slate-900 pb-3 mb-5">
        <div className="flex justify-between items-center text-[11px] sm:text-xs font-mono">
          <span className="text-indigo-400 uppercase tracking-widest font-semibold">
            QUESTION {String(currentNum).padStart(2, '0')} / 10
          </span>
          <span className="text-slate-500 tracking-wider">
            CALIBRATION: {difficulty.toUpperCase()}
          </span>
        </div>
        
        {/* Row of 10 small squares/dashes */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          {Array.from({ length: 10 }).map((_, idx) => {
            const isCurrent = idx === currentQuestionIndex;
            const isAnswered = idx < answers.length;
            const answerDetails = answers[idx];
            
            let squareStyle = "border-slate-800 text-slate-700 bg-transparent";
            let symbol = "□"; // default empty
            
            if (isCurrent) {
              squareStyle = "border-indigo-500 text-indigo-400 font-bold bg-indigo-500/10";
              symbol = "▣"; // current item
            } else if (isAnswered) {
              if (answerDetails && answerDetails.isCorrect) {
                squareStyle = "border-emerald-800 text-emerald-400 bg-emerald-500/10";
                symbol = "■"; // correct
              } else {
                squareStyle = "border-rose-950 text-rose-500 bg-rose-500/10";
                symbol = "■"; // incorrect
              }
            }
            
            return (
              <div 
                key={idx} 
                className={`w-6 h-6 sm:w-7 sm:h-7 border flex items-center justify-center font-mono text-[10px] sm:text-xs rounded ${squareStyle} transition-all duration-200`}
                title={`Question ${idx + 1}`}
              >
                {symbol}
              </div>
            );
          })}
        </div>

        {/* Dynamic progress bar line */}
        <div className="h-[2px] bg-slate-900 w-full overflow-hidden rounded-full">
          <div 
            className="h-full bg-indigo-500 transition-all duration-300" 
            style={{ width: `${(currentNum / 10) * 100}%` }}
          />
        </div>
      </div>
    );
  };

  const accuracyRate = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const currentRunningScore = answers.filter(a => a.isCorrect).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-hidden">
      
      {/* Ambient Corner Gradients */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 blur-[100px] pointer-events-none rounded-full"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-slate-500/10 blur-[100px] pointer-events-none rounded-full"></div>

      {/* Header Navigation - Sleek Theme style */}
      <nav className="h-16 border-b border-slate-800 flex items-center justify-between px-6 sm:px-10 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-4 cursor-pointer" onClick={handleQuitToMenu}>
          <span className="text-[10px] sm:text-xs font-mono tracking-widest text-slate-500 uppercase">System // Niche Trivia v1.5</span>
          <div className="h-4 w-[1px] bg-slate-700 hidden sm:block"></div>
          <h1 className="text-sm sm:text-lg font-medium tracking-tight text-slate-200 uppercase">NICHE TRIVIA</h1>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6">
          {gameState !== "category-select" && (
            <button 
              onClick={handleQuitToMenu}
              className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors py-1.5 px-3 border border-slate-800 bg-slate-950/40 rounded hover:border-slate-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>QUIT ROUND</span>
            </button>
          )}

          <div className="flex flex-col items-end text-right">
            <span className="text-[9px] uppercase tracking-tighter text-slate-500 font-bold font-mono">Difficulty</span>
            <span className="text-xs sm:text-sm text-amber-500 font-semibold uppercase tracking-widest font-mono">
              {difficulty}
            </span>
          </div>
          
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded border border-slate-800 flex flex-col items-center justify-center bg-slate-900 text-[10px] sm:text-xs font-mono text-slate-300">
            <span className="text-[9px] text-slate-500 leading-none mb-0.5">STK</span>
            <span className="font-bold text-slate-100 leading-none">{streak}</span>
          </div>
        </div>
      </nav>

      {/* Main Content Layout */}
      <main className="flex-1 flex flex-col md:flex-row relative z-10">
        
        {/* Sidebar Info (Left branding detail & score tracker) */}
        <aside className="w-full md:w-20 border-b md:border-b-0 md:border-r border-slate-800 flex md:flex-col items-center justify-between md:justify-start py-3 md:py-8 px-6 md:px-0 gap-6 md:gap-12 bg-slate-950/40">
          <div className="md:[writing-mode:vertical-rl] md:rotate-180 text-[10px] tracking-[0.3em] uppercase text-slate-500 font-bold font-mono whitespace-nowrap">
            {(gameState === "playing" || gameState === "results") ? category : "KNOWLEDGE VERIFICATION"}
          </div>
          <div className="hidden md:block flex-1 w-[1px] bg-slate-800"></div>
          <div className="text-xs font-mono text-slate-400 font-bold md:[writing-mode:vertical-rl] md:rotate-180 whitespace-nowrap">
            {(gameState === "playing" || gameState === "results") ? (
              <span className="text-indigo-400">SCORE: {String(currentRunningScore).padStart(2, '0')} / 10</span>
            ) : "STANDBY"}
          </div>
        </aside>

        {/* Play workspace or Setup container */}
        <section className={`flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full ${gameState === "playing" ? "p-4 sm:p-6 lg:p-8 py-4 sm:py-6" : "p-6 sm:p-12 lg:p-16"}`}>
          
          <AnimatePresence mode="wait">
            
            {/* 1. LOADING STATE */}
            {gameState === "loading" && (
              <motion.div 
                key="loader"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-center text-center max-w-md mx-auto py-12"
              >
                <div className="relative mb-8">
                  <div className="w-12 h-12 rounded-full border border-slate-800 border-t-indigo-500 animate-spin" />
                  <BrainCircuit className="w-4 h-4 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <h3 className="text-sm font-mono uppercase tracking-widest text-slate-400 mb-2">ACCESSING DATABASE</h3>
                <p className="text-xs text-slate-500 font-mono tracking-wide">{loadingText}</p>
              </motion.div>
            )}

            {/* 2. ERROR / RESOLUTION */}
            {gameState === "category-select" && error && (
              <motion.div
                key="error-screen"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-xl mx-auto bg-slate-900/40 border border-slate-800 p-8 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 text-amber-500 mb-4">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <h3 className="text-xs font-mono uppercase tracking-widest font-bold">
                    {error.type === "server_error" ? "Connection Transient Issue" : 
                     error.type === "malformed_json" ? "Parsing Anomaly" : 
                     "Calibration Limit"}
                  </h3>
                </div>
                
                <p className="text-slate-400 text-sm mb-6 leading-relaxed font-light font-mono">
                  {error.message}
                </p>

                {error.suggestion && (
                  <div className="bg-slate-950 border border-slate-800 p-5 mb-8">
                    <span className="text-[9px] font-mono text-indigo-400 tracking-wider block mb-1">SUGGESTED HIGHLY-VERIFIED CATEGORY</span>
                    <p className="text-slate-200 font-light text-base mb-4">"{error.suggestion}"</p>
                    <button
                      onClick={() => {
                        setCustomCategory(error.suggestion || "");
                        fetchQuestions(error.suggestion || "");
                      }}
                      className="px-6 py-3 bg-slate-100 text-slate-950 font-mono font-bold text-xs uppercase tracking-widest hover:bg-white transition"
                    >
                      Use Suggestion & Challenge
                    </button>
                  </div>
                )}

                <div className="flex gap-3 justify-end border-t border-slate-800 pt-6">
                  <button
                    onClick={handleQuitToMenu}
                    className="px-6 py-3 border border-slate-800 hover:border-slate-600 text-slate-400 font-mono text-xs uppercase tracking-widest transition"
                  >
                    Dismiss Error
                  </button>
                </div>
              </motion.div>
            )}

            {/* 3. ACTIVE PLAY SYSTEM */}
            {gameState === "playing" && questions.length > 0 && questions[currentQuestionIndex] && (
              <motion.div
                key={`gameplay-${currentQuestionIndex}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-3xl mx-auto flex flex-col"
              >
                {/* Embedded Progress Tracker */}
                {renderProgressBarAndSquares()}

                {/* Meta Tag Info */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="inline-block px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-mono uppercase tracking-widest">
                    {category} // {questions[currentQuestionIndex].fun_fact_tag || "Niche Archive"}
                  </div>
                </div>

                {/* Question Text */}
                <h2 className="text-lg sm:text-2xl font-light leading-snug tracking-tight mb-6 text-slate-50">
                  {questions[currentQuestionIndex].question}
                </h2>

                {/* Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {questions[currentQuestionIndex].options.map((option, idx) => {
                    const isSelected = selectedAnswer === idx;
                    const isCorrect = idx === questions[currentQuestionIndex].answer_index;
                    const hasAnswered = selectedAnswer !== null;

                    let btnStyles = "border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:bg-slate-900 transition-all";
                    let labelStyles = "text-slate-600 group-hover:text-indigo-500";

                    if (hasAnswered) {
                      if (isCorrect) {
                        btnStyles = "border-emerald-500 bg-emerald-500/5 text-emerald-400 font-medium";
                        labelStyles = "text-emerald-500";
                      } else if (isSelected) {
                        btnStyles = "border-rose-500 bg-rose-500/5 text-rose-400";
                        labelStyles = "text-rose-500";
                      } else {
                        btnStyles = "border-slate-900 bg-slate-950/20 text-slate-600 opacity-40";
                        labelStyles = "text-slate-800";
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={hasAnswered}
                        onClick={() => handleSelectAnswer(idx)}
                        className={`group flex items-center p-3.5 sm:p-4 border transition-all text-left w-full relative ${btnStyles}`}
                      >
                        <span className={`text-xs font-mono mr-4 transition-colors ${labelStyles}`}>
                          0{idx + 1}
                        </span>
                        <span className="text-xs sm:text-sm font-light">{option}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 4. SLEEK PAYOFF EXPANSION */}
                <AnimatePresence>
                  {selectedAnswer !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-5 border-t border-slate-900 pt-5"
                    >
                      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center relative bg-slate-900/30 border border-slate-800 p-4 md:p-5 overflow-hidden">
                        
                        {/* Decorative Background Accent */}
                        <div className={`absolute left-0 top-0 h-full w-1.5 ${
                          selectedAnswer === questions[currentQuestionIndex].answer_index ? "bg-emerald-500" : "bg-rose-500"
                        }`}></div>

                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                            {selectedAnswer === questions[currentQuestionIndex].answer_index ? (
                              <>
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                                Correct Calibration
                              </>
                            ) : (
                              <>
                                <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
                                Incorrect Calibration
                              </>
                            )}
                          </div>
                          
                          <p className="text-xs sm:text-sm text-slate-300 font-light italic leading-relaxed">
                            {questions[currentQuestionIndex].explanation}
                          </p>
                        </div>

                        {/* Action details & Continue */}
                        <div className="flex items-center gap-5 mt-3 md:mt-0 w-full md:w-auto border-t md:border-t-0 border-slate-800/60 pt-3 md:pt-0">
                          <div className="text-left md:text-right">
                            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-widest font-mono">Streak</div>
                            <div className="text-lg font-mono text-emerald-500">+{streak}</div>
                          </div>

                          <button
                            onClick={handleNextQuestion}
                            className="flex-1 md:flex-initial px-5 py-2.5 bg-slate-100 text-slate-950 font-bold font-mono text-xs tracking-widest uppercase hover:bg-white transition-colors"
                          >
                            {currentQuestionIndex === questions.length - 1 ? "See Results" : "Next Question →"}
                          </button>
                        </div>

                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            )}

            {/* 5. RESULTS SCREEN */}
            {gameState === "results" && questions.length > 0 && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-3xl mx-auto flex flex-col"
              >
                <div className="text-center mb-10">
                  <span className="text-[10px] font-mono text-indigo-400 tracking-[0.2em] uppercase block mb-2">ROUND CONCLUDED</span>
                  <h2 className="text-3xl sm:text-4xl font-light text-slate-50 mb-4">Verification Report</h2>
                  <div className="h-[1px] bg-gradient-to-r from-transparent via-slate-800 to-transparent w-full"></div>
                </div>

                {/* Big Monospace Score + Verdict */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                  <div className="bg-slate-900/40 border border-slate-800 p-8 flex flex-col items-center justify-center text-center rounded">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">ACCURACY SECURED</span>
                    <div className="text-5xl sm:text-6xl font-mono font-bold text-indigo-400 tracking-tight">
                      {String(answers.filter(a => a.isCorrect).length).padStart(2, '0')} <span className="text-slate-600">/</span> 10
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 mt-2">
                      {Math.round((answers.filter(a => a.isCorrect).length / 10) * 100)}% Match Rate
                    </span>
                  </div>

                  <div className={`border p-8 flex flex-col items-center justify-center text-center rounded ${getVerdict(answers.filter(a => a.isCorrect).length).color}`}>
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-2">CALIBRATION RATING</span>
                    <div className="text-xl sm:text-2xl font-mono font-bold tracking-wider">
                      {getVerdict(answers.filter(a => a.isCorrect).length).text}
                    </div>
                    <p className="text-xs text-slate-400 mt-3 max-w-xs font-light leading-relaxed">
                      {answers.filter(a => a.isCorrect).length >= 9 ? "Authoritative, highly comprehensive domain mastery." :
                       answers.filter(a => a.isCorrect).length >= 7 ? "Deep, obsessive knowledge of minor details." :
                       answers.filter(a => a.isCorrect).length >= 5 ? "Respectable cultural awareness of this field." :
                       answers.filter(a => a.isCorrect).length >= 3 ? "Superficial competence. You know the hits, but miss the true deep cuts." :
                       "Surface tourist. You are merely passing through."}
                    </p>
                  </div>
                </div>

                {/* Question Breakdown Accordion */}
                <div className="mb-10">
                  <h3 className="text-[10px] font-mono text-slate-400 tracking-widest uppercase mb-4">ITEMIZED RESPONSE ARCHIVE</h3>
                  
                  <div className="border border-slate-800 divide-y divide-slate-900 bg-slate-950/40 rounded overflow-hidden">
                    {questions.map((q, idx) => {
                      const ans = answers[idx];
                      const isCorrect = ans?.isCorrect;
                      const isExpanded = expandedIndex === idx;

                      return (
                        <div key={idx} className="transition-colors hover:bg-slate-900/10">
                          <button
                            onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                            className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
                                isCorrect ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="text-sm sm:text-base font-light text-slate-200 truncate pr-4">
                                {q.question}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0 text-slate-500 font-mono text-xs">
                              {isCorrect ? (
                                <span className="text-emerald-400 font-bold">OK</span>
                              ) : (
                                <span className="text-rose-400 font-bold">MISS</span>
                              )}
                              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180 text-indigo-400" : ""}`} />
                            </div>
                          </button>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden bg-slate-900/20 border-t border-slate-900/60"
                              >
                                <div className="p-5 text-xs sm:text-sm font-light space-y-3">
                                  <div>
                                    <span className="font-mono text-[9px] text-slate-500 block uppercase">YOUR ANSWER</span>
                                    <p className={`font-medium ${isCorrect ? "text-emerald-400" : "text-rose-400"}`}>
                                      {ans ? q.options[ans.selectedIndex] : "No Answer"}
                                    </p>
                                  </div>
                                  {!isCorrect && (
                                    <div>
                                      <span className="font-mono text-[9px] text-slate-500 block uppercase">CORRECT FACT</span>
                                      <p className="font-medium text-emerald-400">
                                        {q.options[q.answer_index]}
                                      </p>
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-mono text-[9px] text-slate-500 block uppercase">PAYOFF EXPLANATION</span>
                                    <p className="text-slate-300 italic mt-0.5 leading-relaxed font-light">
                                      {q.explanation}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Buttons Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center border-t border-slate-800 pt-8">
                  {/* Share Score Button */}
                  <button
                    onClick={handleShareResult}
                    className="w-full sm:w-auto px-6 py-3 border border-indigo-500/30 hover:border-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-400 font-mono text-xs uppercase tracking-widest transition flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {copied ? "COPIED TO CLIPBOARD!" : "Share Result"}
                  </button>

                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        fetchQuestions(category);
                      }}
                      className="w-full sm:w-auto px-6 py-3 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white font-mono text-xs uppercase tracking-widest transition"
                    >
                      [ PLAY AGAIN ]
                    </button>
                    <button
                      onClick={handleQuitToMenu}
                      className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-white text-slate-950 font-mono font-bold text-xs uppercase tracking-widest transition"
                    >
                      [ NEW CATEGORY ]
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 6. MENU / SETUP SCREEN */}
            {gameState === "category-select" && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10"
              >
                
                {/* Left Column: Form Controls */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-400 tracking-[0.2em] uppercase block mb-2">INTELLIGENCE CHECK</span>
                    <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white leading-tight">
                      Pick a Category. <br />
                      <span className="text-indigo-400 font-normal">Test your absolute limits.</span>
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm mt-3 leading-relaxed font-light">
                      Input any obscure topic you claim to master. We generate highly-verified, hyper-specific challenges to distinguish true passion from basic memory.
                    </p>
                  </div>

                  {/* Input field */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">Custom Category</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. Vintage Synth Architecture, Stanley Kubrick production..."
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full bg-slate-900/30 border border-slate-800/80 focus:border-indigo-500 py-3.5 pl-11 pr-4 text-slate-200 placeholder:text-slate-600 outline-none transition text-sm font-light uppercase tracking-wider"
                      />
                      <Search className="w-4 h-4 text-slate-600 absolute left-4 top-4" />
                    </div>
                  </div>

                  {/* Difficulty choices */}
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">Calibration level</label>
                      <span className="text-[9px] text-slate-600 font-mono tracking-wider">STRICT ACCURACY GUARANTEE</span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 bg-slate-900/30 p-1.5 border border-slate-800">
                      {(["warm-up", "fan", "obsessive", "scholar"] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setDifficulty(level)}
                          className={`py-2 text-[10px] sm:text-xs font-mono font-medium transition uppercase tracking-widest ${
                            difficulty === level 
                              ? "bg-indigo-600 text-white" 
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {level.replace("-", " ")}
                        </button>
                      ))}
                    </div>

                    {/* Calibration Details */}
                    <div className="border border-slate-800 bg-slate-900/20 p-4">
                      <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest mb-1 text-slate-300">
                        {difficulty.replace("-", " ")} Mode Calibration
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-light">
                        {DIFFICULTY_DESCRIPTIONS[difficulty]?.description}
                      </p>
                    </div>
                  </div>

                  {/* Trigger button */}
                  <button
                    disabled={!customCategory.trim()}
                    onClick={() => handleStartGame(customCategory)}
                    className="w-full py-4 px-6 bg-slate-100 hover:bg-white text-slate-950 font-bold font-mono text-xs tracking-widest uppercase transition disabled:bg-slate-900 disabled:text-slate-700 disabled:cursor-not-allowed"
                  >
                    Generate 10-Question Round
                  </button>

                </div>

                {/* Right Column: Curated curation cards & Match history log */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  
                  {/* Curation card ideas */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">Suggested Curations</span>
                    <div className="grid grid-cols-1 gap-2.5 max-h-[250px] overflow-y-auto pr-1 border border-slate-900 bg-slate-950 p-2">
                      {PRELOADED_CATEGORIES.map((item) => (
                        <button
                          key={item.name}
                          onClick={() => {
                            setCustomCategory(item.name);
                            handleStartGame(item.name);
                          }}
                          className="w-full text-left p-3.5 border border-slate-900 bg-slate-900/15 hover:border-slate-800 hover:bg-slate-900/30 transition flex items-start gap-3 group"
                        >
                          <div className="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-400 group-hover:text-indigo-400 transition-colors">
                            {getCategoryIcon(item.icon)}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold font-mono tracking-wider text-slate-300 group-hover:text-indigo-400 transition-colors uppercase">
                              {item.name}
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 font-light leading-normal">
                              {item.desc}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Verification Record Logs */}
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">Session Verification Log</span>
                      {sessionHistory.length > 0 && (
                        <button 
                          onClick={handleResetStats}
                          className="text-[9px] font-mono text-slate-600 hover:text-rose-400 uppercase tracking-widest transition"
                        >
                          Reset Log
                        </button>
                      )}
                    </div>

                    <div className="border border-slate-900 bg-slate-950 p-4">
                      {sessionHistory.length === 0 ? (
                        <div className="text-center py-6">
                          <BookOpen className="w-4 h-4 text-slate-700 mx-auto mb-2" />
                          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">No active verifications logged</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                          {sessionHistory.map((hist) => {
                            const percentage = Math.round((hist.score / hist.total) * 100);
                            return (
                              <div key={hist.id} className="flex justify-between items-center text-xs border-b border-slate-900/60 pb-2 last:border-0 last:pb-0 font-mono">
                                <div className="truncate max-w-[150px]">
                                  <span className="font-bold text-slate-300 block truncate uppercase text-[10px]">{hist.category}</span>
                                  <span className="text-[8px] text-slate-500 capitalize">{hist.difficulty}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-slate-300 block text-[10px]">{hist.score}/{hist.total} OK</span>
                                  <span className={`text-[9px] font-semibold ${
                                    percentage >= 80 ? "text-emerald-400" :
                                    percentage >= 50 ? "text-amber-400" : "text-rose-400"
                                  }`}>{percentage}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </motion.div>
            )}

          </AnimatePresence>

        </section>

      </main>

      {/* Footer System Disclaimer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 px-6 text-center text-slate-600 font-mono text-[9px] tracking-widest mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>SECURE SYSTEM INTERFACE • POWERED BY GEMINI 3.5 FLASH</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            ONLINE • UTC-07:00 • 2026
          </span>
        </div>
      </footer>

    </div>
  );
}
