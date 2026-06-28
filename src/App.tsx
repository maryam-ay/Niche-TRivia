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
  Search, 
  Home, 
  BookOpen,
  HelpCircle,
  TrendingUp,
  BrainCircuit
} from "lucide-react";
import { TriviaQuestion, GameState, HistoryItem } from "./types";
import { PRELOADED_CATEGORIES, DIFFICULTY_DESCRIPTIONS } from "./data";

export default function App() {
  // Game Setup State
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState<"warm-up" | "fan" | "obsessive" | "scholar">("fan");
  const [customCategory, setCustomCategory] = useState("");
  
  // Game Play State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<TriviaQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Filtering surface-level facts...");
  const [error, setError] = useState<{ type: string; message: string; suggestion?: string } | null>(null);

  // Question Queue State for caching & background fetching
  const [questionQueue, setQuestionQueue] = useState<TriviaQuestion[]>([]);
  const isFetchingRef = useRef(false);

  // Stats State (Persisted in localStorage)
  const [streak, setStreak] = useState(0);
  const [highStreak, setHighStreak] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<HistoryItem[]>([]);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);

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
    if (!loading) return;
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
  }, [loading]);

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

  // Silently pre-fetch 5 questions in the background
  const triggerBackgroundFetch = async (targetCategory: string, currentPrevQuestions: string[]) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const response = await fetch("/api/trivia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: targetCategory,
          difficulty,
          previousQuestions: currentPrevQuestions
        }),
      });

      if (!response.ok) {
        throw new Error("Background fetch failed");
      }

      const data = await response.json();
      if (data.error) {
        // If the background request was refused, silently stop
        isFetchingRef.current = false;
        return;
      }

      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        // Append to current cache queue
        setQuestionQueue(prev => [...prev, ...data.questions]);

        // Add to previous questions list so they don't get repeated
        const newQuestionTexts = data.questions.map((q: any) => q.question);
        setPreviousQuestions(prev => {
          const updated = [...prev];
          newQuestionTexts.forEach((qText: string) => {
            if (!updated.includes(qText)) updated.push(qText);
          });
          return updated;
        });
      }
    } catch (err) {
      console.warn("Silent background pre-fetch failed:", err);
    } finally {
      isFetchingRef.current = false;
    }
  };

  // Initial fetch for a new session (blocks with loading screen)
  const fetchQuestion = async (targetCategory: string, resetPrevious: boolean = false) => {
    setLoading(true);
    setLoadingText("Generating your trivia...");
    setError(null);
    setSelectedAnswer(null);

    const questionsList = resetPrevious ? [] : previousQuestions;

    try {
      const response = await fetch("/api/trivia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: targetCategory,
          difficulty,
          previousQuestions: questionsList
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to contact trivia engine");
      }

      if (data.error === "category_unusable" || data.error === "category_too_narrow") {
        setError({
          type: "category_unusable",
          message: data.reason || `The topic "${targetCategory}" is unusable or too private for verified trivia generation.`,
          suggestion: data.suggestion
        });
        setCurrentQuestion(null);
        setQuestionQueue([]);
      } else if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        const firstQ = data.questions[0];
        const remaining = data.questions.slice(1);
        
        setCurrentQuestion(firstQ);
        setQuestionQueue(remaining);
        setIsPlaying(true);
        setCategory(targetCategory);

        // Pre-populate previous questions cache to keep future fetches unique
        const allFetchedTexts = data.questions.map((q: any) => q.question);
        setPreviousQuestions(prev => {
          const updated = resetPrevious ? [] : [...prev];
          allFetchedTexts.forEach((qText: string) => {
            if (!updated.includes(qText)) updated.push(qText);
          });
          return updated;
        });
      } else {
        throw new Error("No questions returned from API");
      }
    } catch (err: any) {
      setError({
        type: "server_error",
        message: "Hmm, that didn't work. Try again in a sec."
      });
      setCurrentQuestion(null);
      setQuestionQueue([]);
    } finally {
      setLoading(false);
    }
  };

  // Automatically show incoming questions when stuck on empty cache loading
  useEffect(() => {
    if (loading && loadingText === "Loading next question..." && questionQueue.length > 0) {
      const nextQ = questionQueue[0];
      setCurrentQuestion(nextQ);
      setQuestionQueue(questionQueue.slice(1));
      setSelectedAnswer(null);
      setLoading(false);
    }
  }, [loading, loadingText, questionQueue]);

  const handleStartGame = (selectedCat: string) => {
    if (!selectedCat.trim()) return;
    fetchQuestion(selectedCat.trim(), true);
  };

  const handleSelectAnswer = (optionIdx: number) => {
    if (selectedAnswer !== null || !currentQuestion) return;
    
    setSelectedAnswer(optionIdx);
    const isCorrect = optionIdx === currentQuestion.answer_index;

    // Calculate score & stats
    const nextStreak = isCorrect ? streak + 1 : 0;
    const nextHighStreak = Math.max(highStreak, nextStreak);
    const nextTotalAnswered = totalAnswered + 1;
    const nextTotalCorrect = isCorrect ? totalCorrect + 1 : totalCorrect;

    setStreak(nextStreak);
    setHighStreak(nextHighStreak);
    setTotalAnswered(nextTotalAnswered);
    setTotalCorrect(nextTotalCorrect);

    // Save stats
    localStorage.setItem("niche_trivia_high_streak", nextHighStreak.toString());
    localStorage.setItem("niche_trivia_total_answered", nextTotalAnswered.toString());
    localStorage.setItem("niche_trivia_total_correct", nextTotalCorrect.toString());

    // Update Category history state
    const existingHistoryIdx = sessionHistory.findIndex(h => h.category.toLowerCase() === category.toLowerCase() && h.difficulty === difficulty);
    let updatedHistory = [...sessionHistory];

    if (existingHistoryIdx > -1) {
      updatedHistory[existingHistoryIdx].score += isCorrect ? 1 : 0;
      updatedHistory[existingHistoryIdx].total += 1;
      updatedHistory[existingHistoryIdx].date = new Date().toLocaleDateString();
    } else {
      updatedHistory.unshift({
        id: Math.random().toString(36).substr(2, 9),
        category,
        difficulty,
        score: isCorrect ? 1 : 0,
        total: 1,
        date: new Date().toLocaleDateString()
      });
    }

    setSessionHistory(updatedHistory);
    localStorage.setItem("niche_trivia_history", JSON.stringify(updatedHistory));
  };

  const handleNextQuestion = () => {
    if (questionQueue.length > 0) {
      const nextQ = questionQueue[0];
      const nextQueue = questionQueue.slice(1);
      
      setCurrentQuestion(nextQ);
      setQuestionQueue(nextQueue);
      setSelectedAnswer(null);

      // Trigger silent background pre-fetch when queue drops to 2 or fewer items
      if (nextQueue.length <= 2) {
        triggerBackgroundFetch(category, previousQuestions);
      }
    } else {
      // Rare edge case: Queue is completely empty
      setLoadingText("Loading next question...");
      setLoading(true);

      // Silently fetch immediately
      triggerBackgroundFetch(category, previousQuestions);

      // Wait at most 1 second, then dismiss loading spinner if nothing arrived yet
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    }
  };

  const handleQuitToMenu = () => {
    setIsPlaying(false);
    setCurrentQuestion(null);
    setQuestionQueue([]);
    setSelectedAnswer(null);
    setError(null);
    setStreak(0);
    setPreviousQuestions([]);
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
      setQuestionQueue([]);
    }
  };

  const accuracyRate = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-hidden">
      
      {/* Ambient Corner Gradients */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 blur-[100px] pointer-events-none rounded-full"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-slate-500/10 blur-[100px] pointer-events-none rounded-full"></div>

      {/* Header Navigation - Sleek Theme style */}
      <nav className="h-16 border-b border-slate-800 flex items-center justify-between px-6 sm:px-10 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-4 cursor-pointer" onClick={handleQuitToMenu}>
          <span className="text-[10px] sm:text-xs font-mono tracking-widest text-slate-500 uppercase">System // Deep Cuts v1.5</span>
          <div className="h-4 w-[1px] bg-slate-700 hidden sm:block"></div>
          <h1 className="text-sm sm:text-lg font-medium tracking-tight text-slate-200 uppercase">DEEP CUTS</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end text-right">
            <span className="text-[9px] uppercase tracking-tighter text-slate-500 font-bold font-mono">Difficulty Calibration</span>
            <span className="text-xs sm:text-sm text-amber-500 font-semibold uppercase tracking-widest font-mono">
              Level: {difficulty}
            </span>
          </div>
          
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-slate-800 flex flex-col items-center justify-center bg-slate-900 text-[10px] sm:text-xs font-mono text-slate-300">
            <span className="text-[9px] text-slate-500">STK</span>
            <span className="font-bold text-slate-100">{streak}</span>
          </div>
        </div>
      </nav>

      {/* Main Content Layout */}
      <main className="flex-1 flex flex-col md:flex-row relative z-10">
        
        {/* Sidebar Info (Shown on active gameplay or as left branding detail) */}
        <aside className="w-full md:w-16 border-b md:border-b-0 md:border-r border-slate-800 flex md:flex-col items-center justify-between md:justify-start py-3 md:py-8 px-6 md:px-0 gap-6 md:gap-12 bg-slate-950/40">
          <div className="md:[writing-mode:vertical-rl] md:rotate-180 text-[10px] tracking-[0.3em] uppercase text-slate-500 font-bold font-mono">
            {isPlaying ? category : "KNOWLEDGE VERIFICATION"}
          </div>
          <div className="hidden md:block flex-1 w-[1px] bg-slate-800"></div>
          <div className="text-xs font-mono text-slate-500">
            {isPlaying ? `${previousQuestions.length} Qs` : "STANDBY"}
          </div>
        </aside>

        {/* Play workspace or Setup container */}
        <section className="flex-1 flex flex-col p-6 sm:p-12 lg:p-16 justify-center max-w-5xl mx-auto w-full">
          
          <AnimatePresence mode="wait">
            
            {/* 1. LOADING STATE */}
            {loading && (
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
            {!loading && error && (
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
                
                <p className="text-slate-400 text-sm mb-6 leading-relaxed font-light">
                  {error.message}
                </p>

                {error.suggestion && (
                  <div className="bg-slate-950 border border-slate-800 p-5 mb-8">
                    <span className="text-[9px] font-mono text-indigo-400 tracking-wider block mb-1">SUGGESTED HIGHLY-VERIFIED CATEGORY</span>
                    <p className="text-slate-200 font-light text-base mb-4">"{error.suggestion}"</p>
                    <button
                      onClick={() => {
                        setCustomCategory(error.suggestion || "");
                        fetchQuestion(error.suggestion || "", true);
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
                    Back to Menu
                  </button>
                </div>
              </motion.div>
            )}

            {/* 3. ACTIVE PLAY SYSTEM */}
            {!loading && !error && isPlaying && currentQuestion && (
              <motion.div
                key="gameplay"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-3xl mx-auto flex flex-col"
              >
                {/* Meta Tag */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <div className="inline-block px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-mono uppercase tracking-widest">
                    {category} // {currentQuestion.fun_fact_tag || "Lesser-Known Fact"}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 tracking-wider">
                    VERIFICATION NO. {previousQuestions.length}
                  </div>
                </div>

                {/* Question Text */}
                <h2 className="text-2xl sm:text-4xl font-light leading-[1.3] tracking-tight mb-10 text-slate-50">
                  {currentQuestion.question}
                </h2>

                {/* Options Grid (Sleek Theme style with indices) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = selectedAnswer === idx;
                    const isCorrect = idx === currentQuestion.answer_index;
                    const hasAnswered = selectedAnswer !== null;

                    let btnStyles = "border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:bg-slate-900 transition-all";
                    let labelStyles = "text-slate-600 group-hover:text-indigo-500";

                    if (hasAnswered) {
                      if (isCorrect) {
                        btnStyles = "border-emerald-500 bg-emerald-500/5 text-emerald-400";
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
                        className={`group flex items-center p-5 sm:p-6 border transition-all text-left w-full relative ${btnStyles}`}
                      >
                        <span className={`text-xs font-mono mr-5 transition-colors ${labelStyles}`}>
                          0{idx + 1}
                        </span>
                        <span className="text-sm sm:text-base font-light">{option}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 4. SLEEK PAYOFF EXPANSION (only shown when answered) */}
                <AnimatePresence>
                  {selectedAnswer !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-10 border-t border-slate-800 pt-8"
                    >
                      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative bg-slate-900/40 border border-slate-800 p-6 md:p-8 overflow-hidden">
                        
                        {/* Decorative Background Accent */}
                        <div className={`absolute left-0 top-0 h-full w-1.5 ${
                          selectedAnswer === currentQuestion.answer_index ? "bg-emerald-500" : "bg-rose-500"
                        }`}></div>

                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            {selectedAnswer === currentQuestion.answer_index ? (
                              <>
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                                Correct Verification
                              </>
                            ) : (
                              <>
                                <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
                                Incorrect Verification
                              </>
                            )}
                          </div>
                          
                          <p className="text-sm sm:text-base text-slate-300 font-light italic leading-relaxed">
                            {currentQuestion.explanation}
                          </p>
                        </div>

                        {/* Action details & Continue */}
                        <div className="flex items-center gap-6 mt-4 md:mt-0 w-full md:w-auto border-t md:border-t-0 border-slate-800/60 pt-4 md:pt-0">
                          <div className="text-left md:text-right">
                            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-widest font-mono">Streak</div>
                            <div className="text-xl font-mono text-emerald-500">+{streak}</div>
                          </div>

                          <button
                            onClick={handleNextQuestion}
                            className="flex-1 md:flex-initial px-6 sm:px-8 py-3 bg-slate-100 text-slate-950 font-bold text-xs tracking-widest uppercase hover:bg-white transition-colors"
                          >
                            Continue Session
                          </button>
                        </div>

                      </div>

                      {/* Manual Return to Menu option */}
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleQuitToMenu}
                          className="text-[10px] font-mono text-slate-600 hover:text-slate-400 uppercase tracking-widest transition"
                        >
                          Change Topic or Calibration
                        </button>
                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            )}

            {/* 5. MENU / SETUP SCREEN */}
            {!loading && !isPlaying && (
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
                        {DIFFICULTY_DESCRIPTIONS[difficulty].description}
                      </p>
                    </div>
                  </div>

                  {/* Trigger button */}
                  <button
                    disabled={!customCategory.trim()}
                    onClick={() => handleStartGame(customCategory)}
                    className="w-full py-4 px-6 bg-slate-100 hover:bg-white text-slate-950 font-bold font-mono text-xs tracking-widest uppercase transition disabled:bg-slate-900 disabled:text-slate-700 disabled:cursor-not-allowed"
                  >
                    Generate Custom Challenge
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
