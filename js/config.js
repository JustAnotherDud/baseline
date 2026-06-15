const APP_VERSION = '20260615x';

const MEALS = {
  breakfast:   'Pequeno-almoço',
  morning:     'Lanche manhã',
  lunch:       'Almoço',
  afternoon1:  'Lanche tarde 1',
  afternoon2:  'Lanche tarde 2',
  dinner:      'Jantar',
  supper:      'Ceia',
};

// TODO: dead code — verificar se pode ser removido (referenciado por getTargets() em nutrition.js)
let cachedTargets = { calories: 2450, fat: 70, carbs: 315, fiber: 30, protein: 140 };
