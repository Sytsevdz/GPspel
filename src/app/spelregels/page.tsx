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
          <p>Vier coureurs, jouw voorspellingen en elke Grand Prix een nieuwe kans op punten.</p>
        </header>

        <section className="rules-section" aria-labelledby="intro">
          <h2 id="intro">Hoe werkt GPspel?</h2>
          <p>
            Je stelt per Grand Prix een team samen en voorspelt de top 3 van de kwalificatie en de race.
            Tijdens een sprintweekend voorspel je ook de sprintkwalificatie en de sprint. Met je coureurs,
            podiumvoorspellingen en de bonusvraag verdien je punten. Je speelt mee in het algemene
            klassement en kunt in leagues de strijd aangaan met vrienden of collega&apos;s.
          </p>
        </section>

        <section className="rules-section" aria-labelledby="team-kiezen">
          <h2 id="team-kiezen">Je team samenstellen</h2>
          <ul>
            <li>Kies precies <strong>4 verschillende coureurs</strong> uit de deelnemers aan die GP.</li>
            <li>Je hebt maximaal <strong>100,0 miljoen</strong> te besteden.</li>
            <li>Je mag maximaal <strong>1 coureur per F1-team</strong> kiezen.</li>
            <li>Je kunt je keuzes vóór de deadline wijzigen. Sla je wijzigingen steeds opnieuw op.</li>
          </ul>
          <p>
            De prijzen gelden per GP. De berekende prijsladder loopt van 38,0 tot 11,0 miljoen en is
            gebaseerd op eerdere afgeronde GP&apos;s: racepunten plus een prijsbonus voor de kwalificatie
            (3 voor P1, 2 voor P2 en 1 voor P3). Sprintresultaten tellen hiervoor niet mee.
            Bij gelijke prestaties bepalen achtereenvolgens de racepunten, het resultaat in de laatste
            afgeronde race en de naam de volgorde. Deze prijsbonus is iets anders dan je teampunten.
            Als nieuwe prijzen nog ontbreken, kan GPspel de laatst beschikbare prijzen uit een eerdere GP tonen.
            Controleer voor elke GP de getoonde prijzen en of je team binnen het budget past.
          </p>
        </section>

        <section className="rules-section" aria-labelledby="voorspellingen">
          <h2 id="voorspellingen">Voorspellingen doen</h2>
          <p>
            Vul P1, P2 en P3 in voor de kwalificatie en de race. Tijdens een sprintweekend vul je ook
            een top 3 in voor de sprintkwalificatie en de sprint. Binnen elke top 3 kies je drie
            verschillende coureurs. Je mag dezelfde coureur wel in meerdere sessies voorspellen.
            Je voorspellingen staan los van je team: je mag ook coureurs kiezen die niet in je team zitten.
          </p>
          <h3>De bonusvraag</h3>
          <p>De vraag en het aantal te verdienen punten kunnen per GP verschillen. Je kunt bijvoorbeeld voorspellen:</p>
          <ul>
            <li>Op welke racepositie een genoemde coureur eindigt: kies een positie.</li>
            <li>Wie de snelste ronde rijdt: kies een coureur.</li>
            <li>Welk F1-team de meeste punten scoort: kies een team.</li>
          </ul>
          <p>
            Bij de vraag over het beste team tellen alleen de racepunten van de coureurs van dat F1-team
            samen, volgens de racekolom hieronder. Kwalificatie en sprint tellen niet mee. Bij een gelijk
            totaal geeft de alfabetische volgorde van de teamnamen de doorslag.
            Als er geen aparte bonusvraag is ingesteld, voorspel je welk team de snelste pitstop maakt.
          </p>
        </section>

        <section className="rules-section" aria-labelledby="deadline">
          <h2 id="deadline">Wanneer moet alles ingevuld zijn?</h2>
          <p>
            Houd de <strong>deadline die bij de GP staat</strong> aan. Er is één deadline voor je team en
            al je voorspellingen, ook tijdens een sprintweekend. Zodra die is verstreken, staan je keuzes
            vast voor die GP. Wacht dus niet tot de start van de race.
          </p>
          <ul>
            <li>Controleer je vier coureurs, budget en de beperking van één coureur per F1-team.</li>
            <li>Vul alle top 3&apos;s en het antwoord op de bonusvraag in, inclusief de sprintonderdelen als die er zijn.</li>
            <li>Klik op <strong>Alles opslaan</strong> en controleer de bevestiging dat je team en voorspellingen zijn opgeslagen.</li>
          </ul>
        </section>

        <section className="rules-section" aria-labelledby="puntensysteem">
          <h2 id="puntensysteem">Hoe verdien je punten?</h2>
          <section className="rules-subsection" aria-labelledby="teampunten">
            <h3 id="teampunten">1. Punten van je geselecteerde coureurs</h3>
            <p>
              Elk van je vier coureurs verdient punten voor zijn positie per sessie. Je telt hun punten
              bij elkaar op. Buiten de hieronder genoemde posities levert een coureur 0 punten op.
              De sprintkolommen gelden alleen tijdens een sprintweekend.
            </p>
            <div className="rules-table-scroll" role="region" aria-label="Coureurspunten per positie, horizontaal scrollbaar" tabIndex={0}>
              <table className="rules-table">
                <caption>Punten per coureur per sessie</caption>
                <thead>
                  <tr>
                    <th scope="col">Positie</th>
                    <th scope="col">Kwalificatie</th>
                    <th scope="col">Race</th>
                    <th scope="col">Sprintkwalificatie</th>
                    <th scope="col">Sprint</th>
                  </tr>
                </thead>
                <tbody>
                  {driverPoints.map(([position, ...points]) => (
                    <tr key={position}>
                      <th scope="row">{position}</th>
                      {points.map((value, index) => <td key={index}>{value}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>Voorbeeld: een coureur uit je team kwalificeert zich als P2 en eindigt de race als P4. Dat levert je 8 + 12 = 20 teampunten op.</p>
          </section>
          <section className="rules-subsection" aria-labelledby="voorspelpunten">
            <h3 id="voorspelpunten">2. Punten voor je podiumvoorspellingen</h3>
            <ul>
              <li><strong>10 punten</strong>: de coureur eindigt op de exacte voorspelde plek.</li>
              <li><strong>5 punten</strong>: de coureur eindigt in de top 3, maar op een andere plek.</li>
              <li><strong>0 punten</strong>: de coureur eindigt buiten de top 3.</li>
            </ul>
            <p>
              Dit geldt per voorspelde plek, voor elke sessie. Je kunt maximaal 30 punten per top 3
              verdienen: 60 voor kwalificatie en race samen, of 120 als ook sprintkwalificatie en sprint meetellen.
              Exact goed levert 10 punten op, niet 10 plus 5.
            </p>
            <p>
              Voorbeeld: je voorspelt A–B–C en de uitslag is B–A–C. Je krijgt 5 + 5 + 10 = 20 punten.
              Deze punten komen boven op de punten van je geselecteerde coureurs.
            </p>
          </section>
          <section className="rules-subsection" aria-labelledby="bonuspunten">
            <h3 id="bonuspunten">3. Punten voor de bonusvraag</h3>
            <p>
              Een precies goed antwoord levert het bij de vraag getoonde aantal punten op. Een fout of
              ontbrekend antwoord levert 0 punten op; er zijn geen punten voor bijna goed.
              Voor de vraag over de snelste pitstop krijg je 10 punten bij het juiste team en anders 0.
            </p>
            <p><strong>Je GP-totaal = coureurspunten + podiumvoorspellingen + bonuspunten.</strong></p>
          </section>
        </section>

        <section className="rules-section" aria-labelledby="klassementen">
          <h2 id="klassementen">Hoe werken de klassementen?</h2>
          <p>
            Een GP-klassement vergelijkt de punten voor één Grand Prix. Het seizoensklassement telt de
            gepubliceerde GP-punten bij elkaar op. De speler met de meeste punten staat bovenaan;
            bij een gelijk totaal worden spelers op naam gesorteerd.
          </p>
          <p>
            In een league vergelijk je je score met de leden van die league. Het algemene klassement
            vergelijkt alle spelers. Je kunt aan meerdere leagues deelnemen met een deelnemingscode.
            Je hebt per GP één team en één set voorspellingen: die gelden in al je leagues.
          </p>
          <p>
            Tijdens het weekend kunnen al tussenstanden verschijnen zodra scores voor een sessie zijn
            gepubliceerd. Die punten tellen dan ook al mee in het totaal. Na verwerking en publicatie
            van de race en bonuspunten zie je het volledige GP-resultaat. Geannuleerde GP&apos;s tellen
            niet mee in de klassementen.
          </p>
        </section>

        <section className="rules-section" aria-labelledby="vragen">
          <h2 id="vragen">Veelgestelde vragen</h2>
          <section className="rules-subsection">
            <h3>Kan ik mijn team nog wijzigen?</h3>
            <p>Ja, vóór de deadline van die GP. Sla na een wijziging opnieuw op. Na de deadline kun je je team en voorspellingen niet meer aanpassen.</p>
          </section>
          <section className="rules-subsection">
            <h3>Wat gebeurt er als ik geen voorspelling invul?</h3>
            <p>Zonder opgeslagen voorspelling verdien je daarvoor geen punten. Om Alles opslaan te gebruiken, moeten je team en alle verplichte voorspellingen compleet zijn. Alleen iets aanklikken is dus niet genoeg: controleer altijd de opslagbevestiging.</p>
          </section>
          <section className="rules-subsection">
            <h3>Wat is er anders tijdens een sprintweekend?</h3>
            <p>Je vier coureurs verdienen ook punten in de sprintkwalificatie en sprint. Je vult voor beide sessies een extra top 3 in. Alles moet vóór dezelfde GP-deadline zijn opgeslagen.</p>
          </section>
          <section className="rules-subsection">
            <h3>Waarom zijn mijn punten nog niet bijgewerkt?</h3>
            <p>Scores worden per onderdeel gepubliceerd. Een gereden sessie betekent dus niet dat de punten meteen zichtbaar zijn. Een nog niet gepubliceerd onderdeel is nog geen definitieve nulscore.</p>
          </section>
          <section className="rules-subsection">
            <h3>Wat gebeurt er als een GP wordt geannuleerd?</h3>
            <p>Voor een geannuleerde GP kun je geen team of voorspellingen invullen. Er worden geen spelpunten voor die GP toegekend.</p>
          </section>
        </section>
      </article>
    </main>
  );
}
