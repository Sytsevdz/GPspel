export default function SpelregelsPage() {
  return (
    <main className="rules-page">
      <article className="rules-card">
        <header className="rules-section">
          <h1>Spelregels</h1>
          <p>
            In het GP Spel stel je een team samen en doe je voorspellingen per raceweekend. Op basis van resultaten en
            je voorspellingen verzamel je punten en strijd je tegen andere spelers.
          </p>
        </header>

        <section className="rules-section" aria-labelledby="team-kiezen">
          <h2 id="team-kiezen">Team kiezen</h2>
          <ul>
            <li>Je kiest coureurs voor je team vóór elk raceweekend.</li>
            <li>Na de deadline kun je je team niet meer aanpassen voor die Grand Prix.</li>
            <li>Controleer altijd op tijd de deadline om geen punten mis te lopen.</li>
          </ul>
        </section>

        <section className="rules-section" aria-labelledby="coureurprijzen">
          <h2 id="coureurprijzen">Coureurprijzen</h2>
          <p>
            Coureurprijzen worden bepaald op basis van alle <strong>afgeronde</strong> Grand Prix-weekenden vóór de
            GP waarvoor je je team kiest.
          </p>

          <section className="rules-subsection" aria-labelledby="coureurprijzen-basis">
            <h3 id="coureurprijzen-basis">A. Waar is de prijs op gebaseerd?</h3>
            <ul>
              <li>
                <strong>Racepunten</strong> volgens F1-verdeling: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1 (plek 1 t/m 10).
              </li>
              <li>
                <strong>Kwalificatiebonus</strong>: +3 (P1), +2 (P2), +1 (P3).
              </li>
              <li>
                <strong>Seizoensscore</strong> = racepunten + kwalificatiebonus over alle afgeronde eerdere GP&apos;s.
              </li>
            </ul>
          </section>

          <section className="rules-subsection" aria-labelledby="coureurprijzen-verdeling">
            <h3 id="coureurprijzen-verdeling">B. Hoe wordt dat een prijs?</h3>
            <p>Alle actieve coureurs worden gerangschikt op prestatie:</p>
            <ol>
              <li>Hoogste seizoensscore eerst.</li>
              <li>Bij gelijke seizoensscore: meeste racepunten eerst.</li>
              <li>Daarna: betere racepositie in de meest recente afgeronde GP.</li>
              <li>Is het dan nog gelijk, dan op naam (alfabetisch).</li>
            </ol>
            <p>
              Op basis van die ranglijst krijgt elke coureur een vaste prijs uit de prijsladder:
              <br />
              380, 365, 350, 335, 315, 295, 275, 255, 235, 215, 200, 185, 170, 160, 150, 140, 135, 130, 125, 120,
              115, 110.
            </p>
          </section>

          <section className="rules-subsection" aria-labelledby="coureurprijzen-moment">
            <h3 id="coureurprijzen-moment">C. Wanneer veranderen prijzen?</h3>
            <ul>
              <li>Prijzen worden per Grand Prix opnieuw berekend.</li>
              <li>De berekening gebruikt alleen resultaten van eerdere GP&apos;s met status &quot;finished&quot;.</li>
              <li>Tijdens een lopend weekend veranderen prijzen niet tussendoor.</li>
            </ul>
          </section>
        </section>

        <section className="rules-section" aria-labelledby="voorspellingen">
          <h2 id="voorspellingen">Voorspellingen</h2>
          <p>Per Grand Prix voorspel je de top 3 voor:</p>
          <ul>
            <li>Kwalificatie</li>
            <li>Race</li>
          </ul>
          <p>Hoe beter je voorspelling overeenkomt met de uitslag, hoe meer punten je verdient.</p>
        </section>

        <section className="rules-section" aria-labelledby="puntensysteem">
          <h2 id="puntensysteem">Puntensysteem</h2>

          <section className="rules-subsection" aria-labelledby="team-punten">
            <h3 id="team-punten">A. Team punten</h3>
            <p>Je team scoort punten op basis van de prestaties van jouw coureurs per sessie:</p>
            <ul>
              <li>
                <strong>Race:</strong> 25, 18, 15, 12, 10, 8, 6, 4, 2, 1
              </li>
              <li>
                <strong>Sprint race:</strong> 15, 12, 10, 8, 6, 4, 3, 2, 1
              </li>
              <li>
                <strong>Kwalificatie:</strong> 10, 8, 6, 5, 4, 3, 2, 1
              </li>
              <li>
                <strong>Sprint kwalificatie:</strong> 6, 5, 4, 3, 2, 1
              </li>
            </ul>
          </section>

          <section className="rules-subsection" aria-labelledby="voorspelling-punten">
            <h3 id="voorspelling-punten">B. Voorspelling punten</h3>
            <p>
              Voor voorspellingen krijg je punten als je coureurs op de juiste posities zet of dicht bij de echte
              uitslag zit. Een betere inschatting levert meer punten op.
            </p>
          </section>

          <section className="rules-subsection" aria-labelledby="totaal">
            <h3 id="totaal">C. Totaal</h3>
            <p>Je totaalscore is de optelsom van alle team punten en voorspelling punten.</p>
          </section>
        </section>

        <section className="rules-section" aria-labelledby="publicatiemomenten">
          <h2 id="publicatiemomenten">Publicatiemomenten</h2>
          <ul>
            <li>Na de kwalificatie verschijnt een tussenstand met de beschikbare punten.</li>
            <li>Na de race wordt de definitieve stand voor de Grand Prix gepubliceerd.</li>
          </ul>
        </section>

        <section className="rules-section" aria-labelledby="leagues">
          <h2 id="leagues">Leagues</h2>
          <p>
            Je kunt deelnemen aan leagues om met vrienden of collega&apos;s te spelen. In elke league strijd je op
            hetzelfde puntensysteem en zie je wie bovenaan staat.
          </p>
        </section>
      </article>
    </main>
  );
}
