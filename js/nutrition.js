function getNutrientColor(nutrient, pct) {
  switch(nutrient) {
    case 'calories':
      if (pct >= 90 && pct <= 110) return 'var(--accent)';
      if ((pct >= 80 && pct < 90) || (pct > 110 && pct <= 120)) return 'var(--yellow)';
      return 'var(--red)';
    case 'protein':
      if (pct >= 86 && pct <= 130) return 'var(--accent)';
      if ((pct >= 63 && pct < 86) || (pct > 130 && pct <= 150)) return 'var(--yellow)';
      return 'var(--red)';
    case 'fat':
      if (pct >= 85 && pct <= 160) return 'var(--accent)';
      if ((pct >= 54 && pct < 85) || (pct > 160 && pct <= 200)) return 'var(--yellow)';
      return 'var(--red)';
    case 'carbs':
      if (pct >= 85 && pct <= 135) return 'var(--accent)';
      if ((pct >= 70 && pct < 85) || (pct > 135 && pct <= 150)) return 'var(--yellow)';
      return 'var(--red)';
    case 'fiber':
      if (pct >= 90) return 'var(--accent)';
      if (pct >= 70) return 'var(--yellow)';
      return 'var(--red)';
    default:
      return 'var(--accent)';
  }
}

// Estado de um macro mínimo (proteína/gordura) no diário. Sem tecto:
// daily_targets só traz um valor de gordura, não a banda.
// Devolve null sem floor; status 'below' ou 'met'.
function macroFloorState(key, actual, floor) {
  if (!(floor > 0)) return null;
  const val = Math.round(actual);
  const pct = Math.round(actual / floor * 100);
  if (val < floor) return { status: 'below', pct, deficit: Math.round(floor - actual) };
  return { status: 'met', pct };
}
