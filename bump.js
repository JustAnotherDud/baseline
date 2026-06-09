// bump.js
const fs = require('fs');
const today = new Date();
const v = today.getFullYear().toString() +
  String(today.getMonth()+1).padStart(2,'0') +
  String(today.getDate()).padStart(2,'0');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/\?v=\d{8}[a-z]*/g, `?v=${v}`);
fs.writeFileSync('index.html', html);
console.log(`Bumped all ?v= to ${v}`);
