// Data local YYYY-MM-DD. toISOString() dá a data UTC: às 00:30 em UTC+1 ainda é ontem.
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const APP_VERSION = '20260925b';

const MEALS = {
  breakfast:   'Pequeno-almoço',
  morning:     'Lanche manhã',
  lunch:       'Almoço',
  afternoon1:  'Lanche tarde 1',
  afternoon2:  'Lanche tarde 2',
  dinner:      'Jantar',
  supper:      'Ceia',
};
