const APP_VERSION = '20260615f';

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
let cachedTargets = { calories: 2300, fat: 65, carbs: 254, fiber: 30, protein: 175 };
