/**
 * FSRS-6 core math.
 *
 * Ported from the reference implementation (open-spaced-repetition/py-fsrs,
 * MIT licensed, `fsrs/scheduler.py`) so the numbers are the algorithm's, not an
 * approximation of it. Several terms are easy to get subtly wrong from memory
 * and would silently produce bad scheduling forever:
 *
 *   - decay is w[20] (0.1542), NOT the fixed -0.5 of FSRS-4.5
 *   - initial difficulty is exponential in the rating, not linear
 *   - the difficulty update applies linear damping, (10 - D) * delta / 9
 *   - mean reversion reverts toward the *unclamped* initial difficulty for Easy
 *   - forget stability is the min of a long-term and a short-term expression
 *
 * Scheduling here is deliberately deterministic: the reference's interval fuzz
 * is omitted so device and server compute identical due dates, and so the
 * shared test vectors are exact. See docs/06-learning-engine.md.
 */

/** Grades, matching FSRS. The spelling-specific mapping lives in grade(). */
export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 };

export const DEFAULT_PARAMETERS = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
  1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
  1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];

const STABILITY_MIN = 0.001;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;

export class Fsrs {
  /**
   * @param {number[]} [parameters] 21 FSRS-6 weights
   * @param {number} [desiredRetention] probability of recall targeted at review
   */
  constructor(parameters = DEFAULT_PARAMETERS, desiredRetention = 0.9) {
    if (parameters.length !== 21) {
      throw new Error(`FSRS-6 needs 21 parameters, got ${parameters.length}`);
    }
    this.w = parameters;
    this.desiredRetention = desiredRetention;
    this.decay = -parameters[20];
    this.factor = 0.9 ** (1 / this.decay) - 1;
  }

  /** Probability of recall after `elapsedDays` at the given stability. */
  retrievability(stability, elapsedDays) {
    if (!(stability > 0)) return 0;
    const t = Math.max(0, elapsedDays);
    return (1 + (this.factor * t) / stability) ** this.decay;
  }

  initialStability(rating) {
    return clampStability(this.w[rating - 1]);
  }

  initialDifficulty(rating, clamp = true) {
    const d = this.w[4] - Math.E ** (this.w[5] * (rating - 1)) + 1;
    return clamp ? clampDifficulty(d) : d;
  }

  /** Days until the card should next be seen. Always at least 1. */
  interval(stability) {
    const days =
      (stability / this.factor) * (this.desiredRetention ** (1 / this.decay) - 1);
    return Math.max(1, Math.round(days));
  }

  nextDifficulty(difficulty, rating) {
    const delta = -(this.w[6] * (rating - 3));
    // Linear damping: a card already near maximum difficulty moves less.
    const damped = difficulty + ((10 - difficulty) * delta) / 9;
    // Reverts toward the difficulty an Easy first answer would have produced.
    const target = this.initialDifficulty(Rating.Easy, false);
    return clampDifficulty(this.w[7] * target + (1 - this.w[7]) * damped);
  }

  /** Same-day repeat: a word re-asked within the session, not across days. */
  shortTermStability(stability, rating) {
    let increase =
      Math.E ** (this.w[17] * (rating - 3 + this.w[18])) * stability ** -this.w[19];
    if (rating !== Rating.Again) increase = Math.max(increase, 1);
    return clampStability(stability * increase);
  }

  nextStability(difficulty, stability, retrievability, rating) {
    const s =
      rating === Rating.Again
        ? this.forgetStability(difficulty, stability, retrievability)
        : this.recallStability(difficulty, stability, retrievability, rating);
    return clampStability(s);
  }

  forgetStability(difficulty, stability, retrievability) {
    const longTerm =
      this.w[11] *
      difficulty ** -this.w[12] *
      ((stability + 1) ** this.w[13] - 1) *
      Math.E ** ((1 - retrievability) * this.w[14]);
    const shortTerm = stability / Math.E ** (this.w[17] * this.w[18]);
    return Math.min(longTerm, shortTerm);
  }

  recallStability(difficulty, stability, retrievability, rating) {
    const hardPenalty = rating === Rating.Hard ? this.w[15] : 1;
    const easyBonus = rating === Rating.Easy ? this.w[16] : 1;
    return (
      stability *
      (1 +
        Math.E ** this.w[8] *
          (11 - difficulty) *
          stability ** -this.w[9] *
          (Math.E ** ((1 - retrievability) * this.w[10]) - 1) *
          hardPenalty *
          easyBonus)
    );
  }

  /**
   * Advance one review.
   *
   * @param {object|null} state prior {stability, difficulty, reps, lapses}, or
   *   null for a word never attempted
   * @param {number} rating 1..4
   * @param {number} elapsedDays days since the last review (0 for same-day)
   * @returns {{stability:number, difficulty:number, intervalDays:number,
   *            reps:number, lapses:number, mastery:string}}
   */
  review(state, rating, elapsedDays = 0) {
    let stability;
    let difficulty;

    if (!state || state.reps === 0) {
      stability = this.initialStability(rating);
      difficulty = this.initialDifficulty(rating);
    } else if (elapsedDays < 1) {
      stability = this.shortTermStability(state.stability, rating);
      difficulty = this.nextDifficulty(state.difficulty, rating);
    } else {
      const r = this.retrievability(state.stability, elapsedDays);
      stability = this.nextStability(state.difficulty, state.stability, r, rating);
      difficulty = this.nextDifficulty(state.difficulty, rating);
    }

    const reps = (state?.reps ?? 0) + 1;
    const lapses = (state?.lapses ?? 0) + (rating === Rating.Again ? 1 : 0);
    const intervalDays = this.interval(stability);

    return {
      stability,
      difficulty,
      intervalDays,
      reps,
      lapses,
      mastery: masteryFor({ intervalDays, rating, reps, previous: state?.mastery }),
    };
  }
}

/**
 * Map a spelling attempt onto an FSRS grade.
 *
 * The Hard row is the point of this: a one-letter slip is not the same event as
 * a word the learner has never seen, and grading them identically throws away
 * the most useful signal a spelling app has. Rationale in
 * docs/06-learning-engine.md.
 *
 * @param {object} a
 * @param {boolean} a.correct
 * @param {number} [a.editDistance]
 * @param {number} [a.hintsUsed]
 * @param {number} [a.replays]
 * @param {number} [a.latencyMs]
 * @param {number} [a.medianLatencyMs] this profile's median, for the Easy test
 */
export function grade({
  correct,
  editDistance = 0,
  hintsUsed = 0,
  replays = 0,
  latencyMs,
  medianLatencyMs,
}) {
  if (!correct) return editDistance === 1 ? Rating.Hard : Rating.Again;
  if (hintsUsed > 0 || replays >= 3) return Rating.Hard;
  if (
    Number.isFinite(latencyMs) &&
    Number.isFinite(medianLatencyMs) &&
    medianLatencyMs > 0 &&
    latencyMs < medianLatencyMs * 0.5
  ) {
    return Rating.Easy;
  }
  return Rating.Good;
}

/** Mastery state shown to the learner and counted in the parent report. */
export function masteryFor({ intervalDays, rating, reps, previous }) {
  if (rating === Rating.Again) {
    return previous === "mastered" || previous === "review" ? "lapsed" : "learning";
  }
  if (intervalDays >= 21 && reps >= 3) return "mastered";
  if (intervalDays >= 3) return "review";
  return "learning";
}

const clampStability = (s) => Math.max(s, STABILITY_MIN);
const clampDifficulty = (d) => Math.min(Math.max(d, MIN_DIFFICULTY), MAX_DIFFICULTY);
