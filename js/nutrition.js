function getNutrientColor(nutrient, pct) {
  switch(nutrient) {
    case 'calories':
    case 'carbs':
      if (pct >= 90 && pct <= 110) return 'var(--accent)';
      if ((pct >= 80 && pct < 90) || (pct > 110 && pct <= 120)) return 'var(--yellow)';
      return 'var(--red)';
    case 'protein':
      if (pct >= 90 && pct <= 130) return 'var(--accent)';
      if ((pct >= 80 && pct < 90) || (pct > 130 && pct <= 150)) return 'var(--yellow)';
      return 'var(--red)';
    case 'fat':
  if (pct >= 85 && pct <= 160) return 'var(--accent)';
  if ((pct >= 54 && pct < 85) || (pct > 160 && pct <= 200)) return 'var(--yellow)';
  return 'var(--red)';
    case 'satfat':
    case 'sugar':
      if (pct <= 85) return 'var(--accent)';
      if (pct <= 100) return 'var(--yellow)';
      return 'var(--red)';
    case 'fiber':
      if (pct >= 90) return 'var(--accent)';
      if (pct >= 70) return 'var(--yellow)';
      return 'var(--red)';
    default:
      return 'var(--accent)';
  }
}

function getTargets() { return cachedTargets; }
