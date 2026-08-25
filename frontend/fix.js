const fs = require('fs');

let content = fs.readFileSync('src/api/supabase.ts', 'utf8');

content = content.replace(/const filtr = \nomi\.ilike\.% \+ nom \+ %;/g, "const filtr = 'nomi.ilike.%' + nom + '%';");
content = content.replace(/filtr: \\kompaniya_id\.eq\.\\\\/g, "filtr: 'kompaniya_id.eq.' + kompaniya_id");
content = content.replace(/const path = \\\\fakturalar\\/\\\\_\\.\\\\;/g, "const path = 'fakturalar/' + faktura_id + '_' + Date.now() + '.' + ext;");
content = content.replace(/url: \\\\https:\/\/r2\.milliy-os\.uz\/\\\\/g, "url: 'https://r2.milliy-os.uz/' + path");

fs.writeFileSync('src/api/supabase.ts', content);
console.log('Fixed supabase.ts');
