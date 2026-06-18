export const BONUS_QUESTION_TYPES = ["driver_finish_position"] as const;

export type BonusQuestionType = (typeof BONUS_QUESTION_TYPES)[number];

export type BonusQuestion = {
  id: string;
  grand_prix_id: string;
  question_type: BonusQuestionType;
  question_text: string;
  subject_driver_id: string | null;
  points: number;
};

export type BonusPrediction = {
  grand_prix_bonus_question_id: string;
  user_id: string;
  answer_position: number | null;
};

export type BonusAnswer = {
  grand_prix_bonus_question_id: string;
  answer_position: number | null;
};

export type BonusPredictionScore = {
  grand_prix_bonus_question_id: string;
  user_id: string;
  points: number | null;
};

export type BonusPredictionDisplay = {
  questionId: string;
  questionType: BonusQuestionType;
  questionText: string;
  subjectDriverId: string | null;
  pointsAvailable: number;
  selectedPosition: number | null;
  actualPosition: number | null;
  points: number | null;
};

export const isSupportedBonusQuestionType = (
  value: string,
): value is BonusQuestionType =>
  BONUS_QUESTION_TYPES.includes(value as BonusQuestionType);

export const formatFinishPosition = (position: number | null | undefined) =>
  typeof position === "number" && Number.isFinite(position)
    ? `P${position}`
    : "Nog niet bekend";

export const calculateDriverFinishPositionBonusPoints = ({
  predictedPosition,
  actualPosition,
  pointsAvailable,
}: {
  predictedPosition: number | null;
  actualPosition: number | null;
  pointsAvailable: number;
}) => {
  if (!predictedPosition || !actualPosition) {
    return 0;
  }

  return predictedPosition === actualPosition ? pointsAvailable : 0;
};
