const driverPoints = [
  ["P1", 10, 25, 6, 15],
  ["P2", 8, 18, 5, 12],
  ["P3", 6, 15, 4, 10],
  ["P4", 5, 12, 3, 8],
  ["P5", 4, 10, 2, 6],
  ["P6", 3, 8, 1, 4],
  ["P7", 2, 6, 0, 3],
  ["P8", 1, 4, 0, 2],
  ["P9", 0, 2, 0, 1],
  ["P10", 0, 1, 0, 0],
] as const;

export default function SpelregelsPage() {
  return (
    <main className="rules-page">
      <article className="rules-card">
        <header className="rules-section">
          <h1>Spelregels</h1>
          <p>Stel per Grand Prix je team samen, voorspel de uitslagen en verdien punten.</p>
        </header>

        <section className="rules-section" aria-labelledby="team-kiezen">
          <h2 id="team-kiezen">Je team kiezen</h2>
          <ul>
            <li><strong>4 verschillende coureurs</strong> uit de deelnemers aan de GP.</li>
            <li><strong>Maximaal 100,0 miljoen</strong> budget.</li>
            <li><strong>Maximaal 1 coureur per F1-team.</strong></li>
          </ul>
          <details className="rules-price-details">
            <summary>Hoe werken coureursprijzen?</summary>
            <ul>
              <li>De prijsladder loopt van 38,0 tot 11,0 miljoen per GP.</li>
              <li>Basis: racepunten uit eerdere afgeronde GP&apos;s, plus een kwalificatiebonus van 3 / 2 / 1 voor P1 / P2 / P3. Sprintresultaten tellen niet mee.</li>
              <li>Bij gelijkstand: meeste racepunten, beste resultaat in de laatste afgeronde race, daarna alfabetisch op naam.</li>
              <li>Ontbreken nieuwe prijzen? Dan kunnen eerdere prijzen gelden. Controleer altijd het getoonde budget.</li>
            </ul>
          </details>
        </section>

        <section className="rules-section" aria-labelledby="deadline">
          <h2 id="deadline">Invullen en opslaan</h2>
          <p><strong>Eén GP-deadline voor alles</strong>, ook tijdens sprintweekenden. Je kunt je team en voorspellingen tot dat moment wijzigen; daarna staan ze vast.</p>
          <p>Controleer je team, vul alle voorspellingen en de bonusvraag in en klik op <strong>Alles opslaan</strong>. Controleer de opslagbevestiging: zonder opgeslagen voorspelling krijg je daarvoor geen punten.</p>
        </section>

        <section className="rules-section" aria-labelledby="voorspellingen">
          <h2 id="voorspellingen">Voorspellingen</h2>
          <ul>
            <li><strong>Elke GP:</strong> voorspel P1, P2 en P3 van kwalificatie en race.</li>
            <li><strong>Sprintweekend:</strong> ook P1, P2 en P3 van sprintkwalificatie en sprint.</li>
            <li>Drie verschillende coureurs per top 3. Ze hoeven niet in je team te zitten en mogen terugkomen in andere sessies.</li>
          </ul>
          <table className="rules-table">
            <caption>Punten per voorspelde plek, voor elke sessie</caption>
            <thead><tr><th scope="col">Voorspelling</th><th scope="col">Punten</th></tr></thead>
            <tbody>
              <tr><th scope="row">Juiste coureur, exacte plek</th><td>10</td></tr>
              <tr><th scope="row">Juiste coureur, andere plek in top 3</th><td>5</td></tr>
              <tr><th scope="row">Coureur buiten top 3</th><td>0</td></tr>
            </tbody>
          </table>
          <p>Maximaal 30 per top 3: 60 per gewoon weekend, 120 per sprintweekend. Bijvoorbeeld: A–B–C voorspeld, B–A–C gereden = 5 + 5 + 10 = 20 punten.</p>
        </section>

        <section className="rules-section" aria-labelledby="teampunten">
          <h2 id="teampunten">Punten van je coureurs</h2>
          <p>Tel de punten van je vier coureurs per sessie op. Buiten de genoemde posities krijg je 0 punten.</p>
          <div className="rules-points-grid">
            {[false, true].map((sprint) => (
              <table className="rules-table" key={String(sprint)}>
                <caption>{sprint ? "Sprintweekend: extra punten" : "Elke Grand Prix"}</caption>
                <thead>
                  <tr>
                    <th scope="col">Positie</th>
                    <th scope="col">{sprint ? <>Sprint-<br />kwalificatie</> : "Kwalificatie"}</th>
                    <th scope="col">{sprint ? "Sprint" : "Race"}</th>
                  </tr>
                </thead>
                <tbody>
                  {driverPoints.slice(0, sprint ? 9 : 10).map(([position, quali, race, sprintQuali, sprintRace]) => (
                    <tr key={position}>
                      <th scope="row">{position}</th>
                      <td>{sprint ? sprintQuali : quali}</td>
                      <td>{sprint ? sprintRace : race}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </section>

        <section className="rules-section" aria-labelledby="bonusvraag">
          <h2 id="bonusvraag">Bonusvraag</h2>
          <p>De vraag en het puntenaantal kunnen per GP verschillen. Exact goed = het getoonde aantal punten; fout of geen antwoord = 0.</p>
          <table className="rules-table">
            <caption>Mogelijke bonusvragen</caption>
            <thead><tr><th scope="col">Vraag</th><th scope="col">Je kiest</th></tr></thead>
            <tbody>
              <tr><th scope="row">Eindpositie van een genoemde coureur</th><td>Positie</td></tr>
              <tr><th scope="row">Snelste ronde</th><td>Coureur</td></tr>
              <tr><th scope="row">F1-team met de meeste racepunten</th><td>Team</td></tr>
              <tr><th scope="row">Snelste pitstop¹</th><td>Team</td></tr>
            </tbody>
          </table>
          <p>¹ Zonder aparte bonusvraag geldt de pitstopvraag: 10 punten bij het juiste team.</p>
          <p>Voor het beste F1-team tellen alleen de racepunten van zijn coureurs uit de tabel hierboven. Bij gelijkstand beslist de alfabetische teamnaam.</p>
        </section>

        <section className="rules-section" aria-labelledby="klassementen">
          <h2 id="klassementen">Totaalscore en klassementen</h2>
          <p><strong>GP-totaal = coureurspunten + podiumvoorspellingen + bonuspunten.</strong></p>
          <ul>
            <li><strong>GP-klassement:</strong> punten van één Grand Prix.</li>
            <li><strong>Seizoensklassement:</strong> alle gepubliceerde GP-punten opgeteld.</li>
            <li><strong>League:</strong> alleen de leden; <strong>algemeen:</strong> alle spelers. Meeste punten bovenaan, bij gelijkstand op naam.</li>
            <li>Met deelnemingscodes kun je in meerdere leagues spelen. Je team en voorspellingen gelden in al je leagues.</li>
          </ul>
        </section>

        <section className="rules-section" aria-labelledby="publicatie">
          <h2 id="publicatie">Tussenstanden en annuleringen</h2>
          <ul>
            <li><strong>Tussenstand:</strong> verschijnt zodra scores per onderdeel zijn gepubliceerd en telt direct mee in het totaal. Nog niet gepubliceerd betekent niet automatisch 0 punten.</li>
            <li><strong>Volledige GP-score:</strong> na verwerking en publicatie van alle sessies en bonuspunten.</li>
            <li><strong>Geannuleerde GP:</strong> geen teamkeuze, voorspellingen of spelpunten; telt niet mee in het klassement.</li>
          </ul>
        </section>
      </article>
    </main>
  );
}
