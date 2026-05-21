const dtf = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatKickoff(iso: string): string {
  try {
    return dtf.format(new Date(iso));
  } catch {
    return iso;
  }
}

export function isLocked(iso: string, now: Date = new Date()): boolean {
  const k = new Date(iso).getTime();
  return now.getTime() >= k - 60 * 60 * 1000;
}

export function timeLeftLabel(iso: string, now: Date = new Date()): string {
  const k = new Date(iso).getTime();
  const lockAt = k - 60 * 60 * 1000;
  const diff = lockAt - now.getTime();
  if (diff <= 0) return "Cerrado";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Cierra en ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Cierra en ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Cierra en ${days} d`;
}

export const stageLabel: Record<string, string> = {
  group: "Fase de grupos",
  round_of_32: "Dieciseisavos",
  round_of_16: "Octavos",
  quarter_final: "Cuartos",
  semi_final: "Semifinal",
  third_place: "3er puesto",
  final: "Final",
};
