export default function SpelregelsPage() {
  return (
    <main className="rules-page">
      <article className="rules-card">
        <header className="rules-section">
          <h1>Spelregels</h1>
        </header>

        <section className="rules-section" aria-labelledby="intro">
          <h2 id="intro">Intro</h2>
          <p>
            In het GP Spel stel je per Grand Prix een team samen met 4 coureurs en doe je voorspellingen voor
            kwalificatie en race. Je verdient punten met je teamkeuze én met correcte voorspellingen.
          </p>
        </section>

        <section className="rules-section" aria-labelledby="team-kiezen">
          <h2 id="team-kiezen">Team kiezen</h2>
          <ul>
            <li>Je selecteert verplicht 4 coureurs.</li>
            <li>Je totale budget is maximaal 100,0 miljoen.</li>
            <li>Je mag maximaal 1 coureur per F1-team kiezen.</li>
            <li>Na de deadline lockt je team voor die Grand Prix.</li>
            <li>Bij een geannuleerde Grand Prix is er geen teamselectie en geen scoring.</li>
          </ul>
        </section>

        <section className="rules-section" aria-labelledby="coureurprijzen">
          <h2 id="coureurprijzen">Coureurprijzen</h2>
          <p>
            Coureurprijzen worden opnieuw berekend per Grand Prix op basis van prestaties uit alleen eerdere
            Grand Prix&apos;s met status <strong>finished</strong>.
          </p>

          <section className="rules-subsection" aria-labelledby="coureurprijzen-score">
            <h3 id="coureurprijzen-score">Hoe wordt de score opgebouwd?</h3>
            <ul>
              <li>Racepunten worden meegenomen volgens de race-uitslag.</li>
              <li>Kwalificatiebonus telt mee voor P1, P2 en P3.</li>
              <li>Seizoensscore = racepunten + kwalificatiebonus uit eerdere finished GP&apos;s.</li>
            </ul>
          </section>

          <section className="rules-subsection" aria-labelledby="coureurprijzen-ranking">
            <h3 id="coureurprijzen-ranking">Ranking bij gelijke prestaties</h3>
            <ol>
              <li>Hoogste seizoensscore.</li>
              <li>Daarna hoogste totaal racepunten.</li>
              <li>Daarna beste resultaat in de laatste race.</li>
              <li>Daarna alfabetische volgorde.</li>
            </ol>
          </section>

          <section className="rules-subsection" aria-labelledby="coureurprijzen-prijsladder">
            <h3 id="coureurprijzen-prijsladder">Prijsladder</h3>
            <p>De prijsladder loopt van 38,0 miljoen (hoogst) tot 11,0 miljoen (laagst).</p>
          </section>
        </section>

        <section className="rules-section" aria-labelledby="voorspellingen">
          <h2 id="voorspellingen">Voorspellingen</h2>
          <p>Per Grand Prix voorspel je de top 3 voor:</p>
          <ul>
            <li>Kwalificatie</li>
            <li>Race</li>
          </ul>

          <section className="rules-subsection" aria-labelledby="voorspellingen-score">
            <h3 id="voorspellingen-score">Scoring per voorspelde plek</h3>
            <ul>
              <li>10 punten: juiste coureur op de juiste plek.</li>
              <li>5 punten: juiste coureur, maar op een andere plek binnen de top 3.</li>
              <li>0 punten: verkeerde coureur.</li>
            </ul>
          </section>
        </section>

        <section className="rules-section" aria-labelledby="puntensysteem">
          <h2 id="puntensysteem">Puntensysteem</h2>
          <section className="rules-subsection" aria-labelledby="puntensysteem-team">
            <h3 id="puntensysteem-team">Team punten</h3>
            <ul>
              <li>Kwalificatie: 10, 8, 6, 5, 4, 3, 2, 1 (P1 t/m P8)</li>
              <li>Race: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1 (P1 t/m P10)</li>
            </ul>
          </section>
          <section className="rules-subsection" aria-labelledby="puntensysteem-totaal">
            <h3 id="puntensysteem-totaal">Totaalscore</h3>
            <p>Totaal per Grand Prix = teampunten + punten uit voorspellingen.</p>
          </section>
        </section>

        <section className="rules-section" aria-labelledby="publicatiemomenten">
          <h2 id="publicatiemomenten">Publicatiemomenten</h2>
          <ul>
            <li>Na de kwalificatie verschijnt de tussenstand.</li>
            <li>Na de race verschijnt de eindstand.</li>
          </ul>
        </section>

        <section className="rules-section" aria-labelledby="status-gp">
          <h2 id="status-gp">Status van een Grand Prix</h2>
          <ul>
            <li>
              <strong>Bezig:</strong> de deadline is voorbij, maar de race is nog niet verwerkt.
            </li>
            <li>
              <strong>Afgelopen:</strong> de race is verwerkt en de uitslag staat vast.
            </li>
            <li>
              <strong>Geannuleerd:</strong> er is geen gameplay, geen teamselectie en geen scoring.
            </li>
          </ul>
        </section>

        <section className="rules-section" aria-labelledby="leagues">
          <h2 id="leagues">Leagues</h2>
          <p>
            In leagues speel je met een eigen groep (bijvoorbeeld vrienden of collega&apos;s). Iedereen speelt met
            dezelfde spelregels; het verschil zit in de ranglijst binnen jullie league.
          </p>
        </section>

        <section className="rules-section" aria-labelledby="nog-niet-actief">
          <h2 id="nog-niet-actief">Wat nog niet actief is</h2>
          <p>
            Deze pagina beschrijft alleen onderdelen die nu in de gameflow gebruikt worden. Eventuele toekomstige
            uitbreidingen tellen pas mee zodra ze in de app actief zijn.
          </p>
        </section>
      </article>
    </main>
  );
}
