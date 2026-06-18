import { formatFinishPosition, type BonusQuestionType } from "@/lib/bonus-predictions";

export type BonusAnswerOption = {
  value: string;
  label: string;
  description?: string;
};

type BonusPredictionCardProps = {
  questionType: BonusQuestionType;
  questionText: string;
  answerOptions?: BonusAnswerOption[];
  selectedAnswer?: string | null;
  actualAnswer?: string | null;
  points?: number | null;
  showActual?: boolean;
  showPoints?: boolean;
  pointsAvailable?: number | null;
  className?: string;
  icon?: string;
  disabled?: boolean;
  onSelectAnswer?: (answer: string) => void;
};

const formatPoints = (points: number | null | undefined) =>
  typeof points === "number" ? (points > 0 ? `+${points}` : "0") : "Nog niet bekend";

const formatAnswer = (
  answer: string | null | undefined,
  answerOptions: BonusAnswerOption[],
) => {
  if (!answer) {
    return "Nog niet bekend";
  }

  return (
    answerOptions.find((option) => option.value === answer)?.label ??
    formatFinishPosition(Number(answer))
  );
};

export function BonusPredictionCard({
  questionType,
  questionText,
  answerOptions = [],
  selectedAnswer,
  actualAnswer,
  points,
  showActual = false,
  showPoints = false,
  pointsAvailable = null,
  className,
  icon = "🏁",
  disabled = false,
  onSelectAnswer,
}: BonusPredictionCardProps) {
  const rootClassName = ["bonus-prediction-card", className]
    .filter(Boolean)
    .join(" ");
  const canSelectAnswer = Boolean(onSelectAnswer) && !disabled;

  return (
    <div className={rootClassName} data-bonus-question-type={questionType}>
      <div className="bonus-prediction-card-header">
        <div className="bonus-prediction-card-icon" aria-hidden="true">
          {icon}
        </div>
        <div>
          <h3>Bonusvraag</h3>
          <p>{questionText}</p>
        </div>
      </div>

      {pointsAvailable !== null ? (
        <p className="bonus-prediction-helper">
          Goed voorspeld: {pointsAvailable} punten.
        </p>
      ) : null}

      {answerOptions.length > 0 ? (
        <div className="bonus-answer-grid" role="group" aria-label={questionText}>
          {answerOptions.map((option) => {
            const isSelected = selectedAnswer === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`bonus-answer-tile ${isSelected ? "selected" : ""}`}
                aria-pressed={isSelected}
                disabled={!canSelectAnswer}
                onClick={() => onSelectAnswer?.(option.value)}
              >
                <strong>{option.label}</strong>
                {option.description ? <span>{option.description}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {showActual || showPoints || selectedAnswer ? (
        <dl className="bonus-prediction-summary">
          <div>
            <dt>Jouw voorspelling</dt>
            <dd>{formatAnswer(selectedAnswer, answerOptions)}</dd>
          </div>
          {showActual ? (
            <div>
              <dt>Werkelijke plek</dt>
              <dd>{formatAnswer(actualAnswer, answerOptions)}</dd>
            </div>
          ) : null}
          {showPoints ? (
            <div className="bonus-prediction-points-row">
              <dt>Punten</dt>
              <dd>{formatPoints(points)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
