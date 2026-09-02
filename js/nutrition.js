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

// Estado de um macro "floor" (proteína/gordura) para a célula do diário.
// floor é um mínimo, não um teto. Devolve null se não houver floor válido.
// status: 'below' (abaixo do mínimo) | 'met'.
//
// O caso 'over' (gordura >90g absolutos) foi removido — era calibrado para
// um modelo onde a gordura era um floor pequeno e fixo (~60-80g). Desde a
// prescrição por âncoras+banda (sync_hub plans/030/031), a gordura é uma
// banda de 20-35% da energia medida — o alvo do próprio dia (`floor` aqui)
// já ronda regularmente 100-150g, muito acima do antigo tecto de 90g. Um
// tecto absoluto fixo passou a disparar mesmo quando a ingestão bate
// exactamente o alvo prescrito nesse dia. Sem um tecto real vindo do
// backend (daily_targets só expõe um único valor de fat, não a banda
// [min,max]), gordura passa a comportar-se como proteína: floor puro,
// sem sinalização de excesso.
function macroFloorState(key, actual, floor) {
  if (!(floor > 0)) return null;
  const val = Math.round(actual);
  const pct = Math.round(actual / floor * 100);
  if (val < floor) return { status: 'below', pct, deficit: Math.round(floor - actual) };
  return { status: 'met', pct };
}
