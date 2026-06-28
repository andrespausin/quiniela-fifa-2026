export const metadata = { title: "Normativa de puntos · Quiniela FIFA 2026" };

const STAGES: Array<{
  label: string;
  multiplier: number;
  example: { home: number; away: number };
}> = [
  { label: "Fase de grupos", multiplier: 1, example: { home: 2, away: 1 } },
  { label: "Dieciseisavos de final", multiplier: 2, example: { home: 1, away: 0 } },
  { label: "Octavos de final", multiplier: 2, example: { home: 1, away: 0 } },
  { label: "Cuartos de final", multiplier: 3, example: { home: 2, away: 2 } },
  { label: "Semifinal", multiplier: 4, example: { home: 1, away: 1 } },
  { label: "Tercer puesto", multiplier: 2, example: { home: 1, away: 0 } },
  { label: "Final", multiplier: 4, example: { home: 0, away: 0 } },
];

export default function ReglasPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Normativa de puntos</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Cómo se calculan los puntos de cada predicción, con ejemplos por fase del torneo.
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 text-lg font-semibold">Regla base</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>
            <strong>Marcador exacto</strong>: aciertas el resultado tal cual (ej. predices 2-1 y el partido termina 2-1) → <strong>3 puntos base</strong>.
          </li>
          <li>
            <strong>Solo ganador o empate</strong>: aciertas quién gana (o que es empate) pero no el marcador exacto → <strong>1 punto base</strong>.
          </li>
          <li>
            <strong>Fallas</strong> el resultado y el ganador/empate → <strong>0 puntos</strong>.
          </li>
        </ul>
        <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
          Esos puntos base se multiplican por un <strong>multiplicador de fase</strong>: cuanto más avanzado el torneo, más vale cada predicción.
        </p>
      </section>

      <section className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 text-lg font-semibold">Multiplicador por fase</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4">Fase</th>
                <th className="py-2 pr-4">Multiplicador</th>
                <th className="py-2 pr-4">Marcador exacto</th>
                <th className="py-2">Solo ganador/empate</th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map((s) => (
                <tr key={s.label} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">{s.label}</td>
                  <td className="py-2 pr-4">×{s.multiplier}</td>
                  <td className="py-2 pr-4">{3 * s.multiplier} pts</td>
                  <td className="py-2">{1 * s.multiplier} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 text-lg font-semibold">Ejemplos</h2>
        <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
          {STAGES.map((s) => (
            <div key={s.label}>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{s.label} (×{s.multiplier})</p>
              <p>
                Predices <strong>{s.example.home}-{s.example.away}</strong> y el partido termina{" "}
                <strong>{s.example.home}-{s.example.away}</strong> (marcador exacto) → 3 × {s.multiplier} ={" "}
                <strong>{3 * s.multiplier} puntos</strong>.
              </p>
              <p>
                Predices el mismo resultado, pero el partido termina con otro marcador donde gana el mismo equipo
                (o también empata, si tu predicción fue empate) → 1 × {s.multiplier} ={" "}
                <strong>{1 * s.multiplier} punto{s.multiplier === 1 ? "" : "s"}</strong>.
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 text-lg font-semibold">Eliminatorias con penales</h2>
        <p className="mb-2 text-sm text-zinc-700 dark:text-zinc-300">
          En las fases eliminatorias, si predices un <strong>empate</strong>, debes indicar además qué equipo
          crees que avanza por penales (campo &ldquo;ganador&rdquo;). El acierto se evalúa así:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>
            Si el partido termina empatado en los 90&apos;/prórroga y se decide por penales, el resultado
            real para efectos de puntos es el equipo que gana la tanda de penales.
          </li>
          <li>
            Ejemplo (cuartos de final, ×3): predices empate 1-1 e indicas que avanza el equipo local. El
            partido termina 1-1 y el local gana en penales → aciertas el ganador → 1 × 3 = <strong>3 puntos</strong>.
          </li>
          <li>
            Si en el mismo ejemplo el marcador final hubiese sido 1-1 pero ganara el equipo visitante en
            penales, tu predicción de empate ya no cuenta como acierto de ganador → <strong>0 puntos</strong>.
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 text-lg font-semibold">Predicciones de bracket (clasificados)</h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Además de los marcadores, puedes predecir qué equipos clasifican a cada ronda eliminatoria. Por
          cada equipo que predigas correctamente para una ronda, sumas el <strong>multiplicador de esa
          fase</strong> en puntos (por ejemplo, predecir correctamente un finalista suma 4 puntos, igual que
          el multiplicador de la final).
        </p>
      </section>
    </main>
  );
}
