export interface TriviaQuestion {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
  fun_fact_tag: string;
  error?: string;
  suggestion?: string;
}

export interface GameState {
  category: string;
  difficulty: "warm-up" | "fan" | "obsessive" | "scholar";
  score: number;
  streak: number;
  highestStreak: number;
  answeredCount: number;
  previousQuestions: string[];
}

export interface HistoryItem {
  id: string;
  category: string;
  difficulty: string;
  score: number;
  total: number;
  date: string;
}
