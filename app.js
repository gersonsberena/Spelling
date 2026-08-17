const setupScreen = document.getElementById("setup-screen");
const quizScreen = document.getElementById("quiz-screen");
const summaryScreen = document.getElementById("summary-screen");

const wordCountSelect = document.getElementById("word-count");
const startBtn = document.getElementById("start-btn");
const setupError = document.getElementById("setup-error");

const progressCurrent = document.getElementById("progress-current");
const progressTotal = document.getElementById("progress-total");
const hearWordBtn = document.getElementById("hear-word-btn");
const partOfSpeechEl = document.getElementById("part-of-speech");
const definitionEl = document.getElementById("definition");
const sentenceEl = document.getElementById("sentence");
const answerForm = document.getElementById("answer-form");
const answerInput = document.getElementById("answer-input");
const feedbackEl = document.getElementById("feedback");
const nextBtn = document.getElementById("next-btn");

const summaryScore = document.getElementById("summary-score");
const summaryList = document.getElementById("summary-list");
const restartBtn = document.getElementById("restart-btn");

const ALLOWED_GRADES = [3, 4];

let sessionWords = [];
let currentIndex = 0;
let results = [];
let advanceTimer = null;
let supabaseClient = null;

if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey) {
  supabaseClient = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
  );
} else {
  setupError.textContent =
    "Missing Supabase config. Copy config.example.js to config.js and fill in your project URL and anon key.";
  setupError.hidden = false;
  startBtn.disabled = true;
}

function speak(text) {
  if (!text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(utterance);
}

function weightForWord(row) {
  const stats = row.word_stats && row.word_stats[0];
  if (!stats || stats.times_seen === 0) return 1;
  const missRatio = stats.times_missed / stats.times_seen;
  return 1 + 3 * missRatio;
}

// Efraimidis-Spirakis weighted sampling without replacement.
function weightedSample(rows, n) {
  const keyed = rows.map((row) => ({
    row,
    key: Math.random() ** (1 / weightForWord(row)),
  }));
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, n).map((k) => k.row);
}

async function loadWords() {
  const { data, error } = await supabaseClient
    .from("words")
    .select("id, word, part_of_speech, definition, sample_sentence, grade_level, word_stats(times_seen, times_missed)")
    .in("grade_level", ALLOWED_GRADES);

  if (error) throw error;
  return data;
}

async function startSession(count) {
  startBtn.disabled = true;
  setupError.hidden = true;

  try {
    const allWords = await loadWords();
    if (allWords.length === 0) {
      throw new Error("No words found. Has the word list been imported yet?");
    }
    sessionWords = weightedSample(allWords, Math.min(count, allWords.length));
    currentIndex = 0;
    results = [];

    setupScreen.hidden = true;
    summaryScreen.hidden = true;
    quizScreen.hidden = false;
    progressTotal.textContent = String(sessionWords.length);
    showWord(0);
  } catch (err) {
    setupError.textContent = err.message || "Something went wrong loading the word list.";
    setupError.hidden = false;
  } finally {
    startBtn.disabled = false;
  }
}

function showWord(index) {
  clearTimeout(advanceTimer);
  const word = sessionWords[index];

  progressCurrent.textContent = String(index + 1);
  partOfSpeechEl.textContent = word.part_of_speech || "";
  definitionEl.textContent = word.definition || "";
  sentenceEl.textContent = word.sample_sentence || "";

  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  nextBtn.hidden = true;
  answerInput.value = "";
  answerInput.disabled = false;
  answerInput.focus();

  speak(word.word);
}

function submitAnswer() {
  if (answerInput.disabled) return;

  const word = sessionWords[currentIndex];
  const guess = answerInput.value.trim().toLowerCase();
  const correct = guess === word.word.trim().toLowerCase();

  results.push({ word: word.word, correct });

  if (correct) {
    feedbackEl.textContent = "Correct!";
    feedbackEl.className = "feedback correct";
  } else {
    feedbackEl.textContent = `Not quite. The correct spelling is: ${word.word}`;
    feedbackEl.className = "feedback incorrect";
  }

  answerInput.disabled = true;
  nextBtn.hidden = false;
  nextBtn.focus();

  advanceTimer = setTimeout(nextWord, correct ? 1800 : 3200);
}

function nextWord() {
  clearTimeout(advanceTimer);
  currentIndex += 1;
  if (currentIndex < sessionWords.length) {
    showWord(currentIndex);
  } else {
    finishSession();
  }
}

async function finishSession() {
  quizScreen.hidden = true;
  summaryScreen.hidden = false;

  const correctCount = results.filter((r) => r.correct).length;
  summaryScore.textContent = `${correctCount} / ${results.length} correct`;

  summaryList.innerHTML = "";
  results.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r.word;
    li.className = r.correct ? "correct" : "incorrect";
    summaryList.appendChild(li);
  });

  await saveResults();
}

async function saveResults() {
  const nowIso = new Date().toISOString();

  const updates = sessionWords.map((word) => {
    const stats = word.word_stats && word.word_stats[0];
    const priorSeen = stats ? stats.times_seen : 0;
    const priorMissed = stats ? stats.times_missed : 0;
    const result = results.find((r) => r.word === word.word);
    const missed = result && !result.correct;

    return supabaseClient
      .from("word_stats")
      .update({
        times_seen: priorSeen + 1,
        times_missed: priorMissed + (missed ? 1 : 0),
        last_seen_at: nowIso,
      })
      .eq("word_id", word.id);
  });

  const outcomes = await Promise.allSettled(updates);
  outcomes.forEach((outcome) => {
    if (outcome.status === "rejected" || outcome.value?.error) {
      console.error("Failed to save word stats:", outcome.reason || outcome.value.error);
    }
  });
}

startBtn.addEventListener("click", () => {
  const count = parseInt(wordCountSelect.value, 10);
  startSession(count);
});

hearWordBtn.addEventListener("click", () => {
  const word = sessionWords[currentIndex];
  if (word) speak(word.word);
});

document.querySelectorAll("[data-speak-target]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.speakTarget);
    speak(target.textContent);
  });
});

answerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (answerInput.disabled) {
    nextWord();
  } else {
    submitAnswer();
  }
});

nextBtn.addEventListener("click", nextWord);

restartBtn.addEventListener("click", () => {
  summaryScreen.hidden = true;
  setupScreen.hidden = false;
});
