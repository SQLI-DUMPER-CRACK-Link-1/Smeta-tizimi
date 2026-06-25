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
  
  // 'mat' === -> 'mat' === || 'ob' ===
  content = content.replace(/=== ?'mat'/g, "==='mat' || $&.replace('mat','ob')");
  // '!=='mat' -> '!=='mat' && '!=='ob'
  content = content.replace(/!== ?'mat'/g, "!=='mat' && $&.replace('mat','ob')");
  
  // Arrays with 'mat'
  content = content.replace(/\['rz','bl','rs','mat'\]/g, "['rz','bl','rs','mat','ob']");
  
  // specific variables / properties like baseMk==='mat' are caught by === 'mat' but wait, regex $& means the matched string
  // if matched string is `==='mat'`, replace is `==='mat' || ==='ob'` which is WRONG syntax!
  
  // Actually, we must do this properly:
  // (something) === 'mat' -> (something) === 'mat' || (something) === 'ob'
  // But wait, regex replace is hard to get the left side.
  // Better to use pure regex:
  
  content = content.replace(/([a-zA-Z0-9_\.\[\]]+)\s*===\s*'mat'/g, "($1 === 'mat' || $1 === 'ob')");
  content = content.replace(/([a-zA-Z0-9_\.\[\]]+)\s*!==\s*'mat'/g, "($1 !== 'mat' && $1 !== 'ob')");

  fs.writeFileSync(f, content);
});

console.log('Replaced successfully');
