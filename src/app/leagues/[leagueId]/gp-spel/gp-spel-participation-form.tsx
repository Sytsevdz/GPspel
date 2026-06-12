"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { useFormState, useFormStatus } from "react-dom";

import {
  saveGPSpelParticipation,
  type GPSpelParticipationActionState,
} from "@/app/actions/gp-spel-participation";

import { PredictionsForm } from "../predictions/predictions-form";
import { TeamSelectionCompactForm } from "./team-selection-compact-form";

type TeamSelectionProps = ComponentProps<typeof TeamSelectionCompactForm>;
type PredictionsProps = ComponentProps<typeof PredictionsForm>;

type GPSpelParticipationFormProps = {
  teamPoints: number | null;
  predictionPoints: number | null;
  readOnly: boolean;
  teamFormProps: Omit<
    TeamSelectionProps,
    "standalone" | "savedVersion" | "onDirtyChange" | "onValidityChange"
  >;
  predictionsFormProps: Omit<
    PredictionsProps,
    | "standalone"
    | "savedVersion"
    | "teamHasUnsavedChanges"
    | "onDirtyChange"
    | "onValidityChange"
    | "onInteracted"
  >;
};

const INITIAL_STATE: GPSpelParticipationActionState = { status: "idle" };

function SaveAllButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="predictions-submit-button"
      disabled={disabled || pending}
    >
      {pending ? "Alles opslaan..." : "Alles opslaan"}
    </button>
  );
}

export function GPSpelParticipationForm({
  teamPoints,
  predictionPoints,
  readOnly,
  teamFormProps,
  predictionsFormProps,
}: GPSpelParticipationFormProps) {
  const [state, formAction] = useFormState(
    saveGPSpelParticipation,
    INITIAL_STATE,
  );
  const [teamIsDirty, setTeamIsDirty] = useState(false);
  const [predictionsAreDirty, setPredictionsAreDirty] = useState(false);
  const [teamIsValid, setTeamIsValid] = useState(false);
  const [predictionsAreValid, setPredictionsAreValid] = useState(false);
  const [savedVersion, setSavedVersion] = useState(0);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasUnsavedChanges = teamIsDirty || predictionsAreDirty;
  const hasSaveError = state.status === "error";
  const showSaveBar =
    !readOnly && (hasUnsavedChanges || showSaveSuccess || hasSaveError);
  const canSave = !readOnly && teamIsValid && predictionsAreValid;

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    setSavedVersion((current) => current + 1);
    setShowSaveSuccess(true);

    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }

    successTimeoutRef.current = setTimeout(() => {
      setShowSaveSuccess(false);
      successTimeoutRef.current = null;
    }, 1800);
  }, [state]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(
      "gp-spel-has-unsaved-changes",
      hasUnsavedChanges ? "true" : "false",
    );

    return () => {
      window.sessionStorage.removeItem("gp-spel-has-unsaved-changes");
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.href === window.location.href || anchor.target === "_blank") {
        return;
      }

      const confirmed = window.confirm(
        "Je hebt niet-opgeslagen wijzigingen. Weet je zeker dat je deze pagina wilt verlaten?",
      );

      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedChanges]);

  const handleTeamDirtyChange = useCallback((isDirty: boolean) => {
    setTeamIsDirty(isDirty);
  }, []);

  const handlePredictionsDirtyChange = useCallback((isDirty: boolean) => {
    setPredictionsAreDirty(isDirty);
  }, []);

  const handleTeamValidityChange = useCallback((isValid: boolean) => {
    setTeamIsValid(isValid);
  }, []);

  const handlePredictionsValidityChange = useCallback((isValid: boolean) => {
    setPredictionsAreValid(isValid);
  }, []);

  return (
    <form
      action={formAction}
      className={`gp-spel-participation-form ${showSaveBar ? "gp-spel-participation-form--save-bar-visible" : ""}`.trim()}
    >
      <section className="gp-spel-section" aria-labelledby="team-kiezen-title">
        <div className="gp-spel-section-header">
          <h2 id="team-kiezen-title">Team kiezen</h2>
          {teamPoints !== null ? (
            <p className="gp-spel-section-points">Team punten: {teamPoints}</p>
          ) : null}
        </div>
        <TeamSelectionCompactForm
          {...teamFormProps}
          standalone={false}
          savedVersion={savedVersion}
          onDirtyChange={handleTeamDirtyChange}
          onValidityChange={handleTeamValidityChange}
        />
      </section>

      <section
        className="gp-spel-section"
        aria-labelledby="voorspellingen-title"
      >
        <div className="gp-spel-section-header">
          <h2 id="voorspellingen-title">Voorspellingen</h2>
          {predictionPoints !== null ? (
            <p className="gp-spel-section-points">
              Voorspelling punten: {predictionPoints}
            </p>
          ) : null}
        </div>
        <PredictionsForm
          {...predictionsFormProps}
          standalone={false}
          savedVersion={savedVersion}
          teamHasUnsavedChanges={teamIsDirty}
          onDirtyChange={handlePredictionsDirtyChange}
          onValidityChange={handlePredictionsValidityChange}
        />
      </section>

      {showSaveBar ? (
        <div
          className={`gp-spel-save-bar ${hasSaveError ? "gp-spel-save-bar--error" : ""} ${showSaveSuccess ? "gp-spel-save-bar--success" : ""}`.trim()}
          role="status"
        >
          <div className="gp-spel-save-bar-copy">
            <strong>
              {showSaveSuccess ? "Opgeslagen" : "Niet-opgeslagen wijzigingen"}
            </strong>
            {!showSaveSuccess ? (
              <span>
                {[
                  teamIsDirty ? "Team gewijzigd" : null,
                  predictionsAreDirty ? "Voorspellingen gewijzigd" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
            {hasSaveError && state.message ? (
              <span className="gp-spel-save-bar-message">{state.message}</span>
            ) : null}
          </div>
          {!showSaveSuccess ? <SaveAllButton disabled={!canSave} /> : null}
        </div>
      ) : null}
    </form>
  );
}
