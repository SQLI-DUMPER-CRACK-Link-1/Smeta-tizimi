const fs = require('fs');
const files = [
  'Smeta tizimi/10_Engine.js', 
  'Smeta tizimi/15_IshTurlar.js', 
  'Smeta tizimi/20_Server.js', 
  'Smeta tizimi/30_Panel.js', 
  'Smeta tizimi/45_Hujjatlar.js', 
  'Smeta tizimi/70_Supabase.js', 
  'Smeta tizimi/98_SelfTest.js'
];
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/\|\|\s*==='mat'\.replace\('mat','ob'\)/g, '');
  content = content.replace(/&&\s*!=='mat'\.replace\('mat','ob'\)/g, '');
  content = content.replace(/\|\|\s*==='ob'/g, '');
  content = content.replace(/&&\s*!=='ob'/g, '');
  
  // Specifically fix line 491 in Engine.js
  content = content.replace(/else if\(\(tur === 'mat' \|\| tur === 'ob'\) \|\| \)\{/g, "else if(tur === 'mat' || tur === 'ob'){");
  
  fs.writeFileSync(f, content);
});
console.log('Fixed');
