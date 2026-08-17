const setupScreen = document.getElementById("setup-screen");
const quizScreen = document.getElementById("quiz-screen");
const summaryScreen = document.getElementById("summary-screen");
const historyScreen = document.getElementById("history-screen");

const modePracticeRadio = document.getElementById("mode-practice");
const modeRetestRadio = document.getElementById("mode-retest");
const wordCountField = document.getElementById("word-count-field");
const wordCountSelect = document.getElementById("word-count");
const retestNote = document.getElementById("retest-note");
const startBtn = document.getElementById("start-btn");
const historyBtn = document.getElementById("history-btn");
const setupError = document.getElementById("setup-error");

const progressCurrent = document.getElementById("progress-current");
const progressTotal = document.getElementById("progress-total");
const restartQuizBtn = document.getElementById("restart-quiz-btn");
const hearWordBtn = document.getElementById("hear-word-btn");
const partOfSpeechEl = document.getElementById("part-of-speech");
const definitionEl = document.getElementById("definition");
const sentenceEl = document.getElementById("sentence");
const answerForm = document.getElementById("answer-form");
const answerInput = document.getElementById("answer-input");
const feedbackEl = document.getElementById("feedback");
const nextBtn = document.getElementById("next-btn");

const summaryScore = document.getElementById("summary-score");
const summaryMissedSection = document.getElementById("summary-missed-section");
const summaryMissedList = document.getElementById("summary-missed-list");
const summaryCorrectSection = document.getElementById("summary-correct-section");
const summaryCorrectList = document.getElementById("summary-correct-list");
const retestMissedBtn = document.getElementById("retest-missed-btn");
const restartBtn = document.getElementById("restart-btn");
const summaryHistoryBtn = document.getElementById("summary-history-btn");

const historyEmpty = document.getElementById("history-empty");
const historyList = document.getElementById("history-list");
const historyBackBtn = document.getElementById("history-back-btn");

const ALLOWED_GRADES = [3, 4];
const RETEST_MAX_WORDS = 50;

let sessionWords = [];
let currentIndex = 0;
let results = [];
let sessionMode = "practice";
let sessionStartedAt = null;
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

function showScreen(screen) {
  [setupScreen, quizScreen, summaryScreen, historyScreen].forEach((s) => {
    s.hidden = s !== screen;
  });
}

function weightForWord(row) {
  const stats = row.word_stats && row.word_stats[0];
  if (!stats || stats.times_seen === 0) return 1;
  const missRatio = stats.times_missed / stats.times_seen;
  return 1 + 3 * missRatio;
}

// Efraimidis-Spirakis weighted sampling without replacement.
function weightedSample(rows, n, weightFn = weightForWord) {
  const keyed = rows.map((row) => ({
    row,
    key: Math.random() ** (1 / weightFn(row)),
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

async function loadMissedWords() {
  const { data: missedStats, error: statsError } = await supabaseClient
    .from("word_stats")
    .select("word_id")
    .eq("last_result", "incorrect");

  if (statsError) throw statsError;
  if (missedStats.length === 0) return [];

  const missedIds = missedStats.map((s) => s.word_id);

  const { data, error } = await supabaseClient
    .from("words")
    .select("id, word, part_of_speech, definition, sample_sentence, grade_level")
    .in("id", missedIds)
    .in("grade_level", ALLOWED_GRADES);

  if (error) throw error;
  return data;
}

async function startSession(mode, count) {
  startBtn.disabled = true;
  setupError.hidden = true;

  try {
    let words;
    if (mode === "retest") {
      const missedWords = await loadMissedWords();
      if (missedWords.length === 0) {
        setupError.textContent = "No missed words to retest right now — nice work! Try Practice words instead.";
        setupError.hidden = false;
        return;
      }
      words = weightedSample(missedWords, Math.min(RETEST_MAX_WORDS, missedWords.length), () => 1);
    } else {
      const allWords = await loadWords();
      if (allWords.length === 0) {
        throw new Error("No words found. Has the word list been imported yet?");
      }
      words = weightedSample(allWords, Math.min(count, allWords.length));
    }

    sessionMode = mode;
    sessionWords = words;
    sessionStartedAt = new Date().toISOString();
    currentIndex = 0;
    results = [];

    showScreen(quizScreen);
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

  results.push({ wordId: word.id, word: word.word, correct });

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

function abandonSession() {
  clearTimeout(advanceTimer);
  window.speechSynthesis.cancel();
  sessionWords = [];
  results = [];
  showScreen(setupScreen);
}

async function finishSession() {
  showScreen(summaryScreen);

  const correctCount = results.filter((r) => r.correct).length;
  const accuracy = results.length ? Math.round((correctCount / results.length) * 100) : 0;
  summaryScore.textContent = `${correctCount} / ${results.length} correct (${accuracy}%)`;

  const missed = results.filter((r) => !r.correct);
  const correctResults = results.filter((r) => r.correct);

  summaryMissedList.innerHTML = "";
  missed.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r.word;
    summaryMissedList.appendChild(li);
  });
  summaryMissedSection.hidden = missed.length === 0;

  summaryCorrectList.innerHTML = "";
  correctResults.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r.word;
    summaryCorrectList.appendChild(li);
  });
  summaryCorrectSection.hidden = correctResults.length === 0;

  await saveResults(correctCount);
}

async function saveResults(correctCount) {
  const nowIso = new Date().toISOString();

  const statsUpdates = sessionWords.map((word) => {
    const stats = word.word_stats && word.word_stats[0];
    const priorSeen = stats ? stats.times_seen : 0;
    const priorMissed = stats ? stats.times_missed : 0;
    const result = results.find((r) => r.wordId === word.id);
    const missed = result && !result.correct;

    return supabaseClient
      .from("word_stats")
      .update({
        times_seen: priorSeen + 1,
        times_missed: priorMissed + (missed ? 1 : 0),
        last_seen_at: nowIso,
        last_result: missed ? "incorrect" : "correct",
      })
      .eq("word_id", word.id);
  });

  const outcomes = await Promise.allSettled(statsUpdates);
  outcomes.forEach((outcome) => {
    if (outcome.status === "rejected" || outcome.value?.error) {
      console.error("Failed to save word stats:", outcome.reason || outcome.value.error);
    }
  });

  const { data: session, error: sessionError } = await supabaseClient
    .from("sessions")
    .insert({
      started_at: sessionStartedAt,
      finished_at: nowIso,
      mode: sessionMode,
      word_count: results.length,
      correct_count: correctCount,
    })
    .select("id")
    .single();

  if (sessionError) {
    console.error("Failed to save session:", sessionError.message);
    return;
  }

  const sessionWordsPayload = results.map((r) => ({
    session_id: session.id,
    word_id: r.wordId,
    correct: r.correct,
  }));

  const { error: sessionWordsError } = await supabaseClient.from("session_words").insert(sessionWordsPayload);
  if (sessionWordsError) {
    console.error("Failed to save session word results:", sessionWordsError.message);
  }
}

function retestMissedFromSummary() {
  const missedWordObjs = sessionWords.filter((w) => results.some((r) => r.wordId === w.id && !r.correct));
  if (missedWordObjs.length === 0) return;

  sessionMode = "retest";
  sessionWords = missedWordObjs;
  sessionStartedAt = new Date().toISOString();
  currentIndex = 0;
  results = [];

  showScreen(quizScreen);
  progressTotal.textContent = String(sessionWords.length);
  showWord(0);
}

async function showHistory() {
  showScreen(historyScreen);
  historyList.innerHTML = "";
  historyEmpty.hidden = true;

  const { data, error } = await supabaseClient
    .from("sessions")
    .select("id, finished_at, mode, word_count, correct_count")
    .order("finished_at", { ascending: false })
    .limit(20);

  if (error) {
    historyEmpty.textContent = "Couldn't load history right now.";
    historyEmpty.hidden = false;
    return;
  }

  if (data.length === 0) {
    historyEmpty.hidden = false;
    return;
  }

  data.forEach((session) => {
    const accuracy = session.word_count ? Math.round((session.correct_count / session.word_count) * 100) : 0;
    const date = new Date(session.finished_at);
    const modeLabel = session.mode === "retest" ? "Retest" : "Practice";

    const li = document.createElement("li");

    const dateSpan = document.createElement("span");
    dateSpan.className = "history-date";
    dateSpan.textContent = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

    const detailSpan = document.createElement("span");
    detailSpan.textContent = `${modeLabel}: ${session.correct_count}/${session.word_count} (${accuracy}%)`;

    li.appendChild(dateSpan);
    li.appendChild(detailSpan);
    historyList.appendChild(li);
  });
}

modePracticeRadio.addEventListener("change", updateModeUI);
modeRetestRadio.addEventListener("change", updateModeUI);

function updateModeUI() {
  const isRetest = modeRetestRadio.checked;
  wordCountField.hidden = isRetest;
  retestNote.hidden = !isRetest;
  retestNote.textContent = `Retests whatever you've most recently gotten wrong, up to ${RETEST_MAX_WORDS} words.`;
  setupError.hidden = true;
}

startBtn.addEventListener("click", () => {
  const mode = modeRetestRadio.checked ? "retest" : "practice";
  const count = parseInt(wordCountSelect.value, 10);
  startSession(mode, count);
});

historyBtn.addEventListener("click", showHistory);
summaryHistoryBtn.addEventListener("click", showHistory);
historyBackBtn.addEventListener("click", () => showScreen(setupScreen));

restartQuizBtn.addEventListener("click", abandonSession);

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

retestMissedBtn.addEventListener("click", retestMissedFromSummary);

restartBtn.addEventListener("click", () => showScreen(setupScreen));
