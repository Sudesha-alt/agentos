import { formatScorePercent } from "../../entities/discovery";

/** Display formula score with uncertainty band, e.g. "74% ±8% (66–82%)". */
export function formatScoreBand(band) {
  if (!band || typeof band.point !== "number") return "—";
  const pct = formatScorePercent(band.point);
  const pm =
    typeof band.uncertainty === "number"
      ? ` ±${Math.round(band.uncertainty * 100)}%`
      : "";
  const range =
    typeof band.low === "number" && typeof band.high === "number"
      ? ` (${Math.round(band.low * 100)}–${Math.round(band.high * 100)}%)`
      : "";
  return `${pct}${pm}${range}`;
}
