const fs = require('fs');

function replaceAlerts(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/SpreadsheetApp\.getUi\(\)\.alert\((.*?)\);/g, 'return {message: $1};');
  fs.writeFileSync(filePath, content);
}

replaceAlerts('Akt generator/Code.js');
replaceAlerts('Akt generator/DashboardAnalyzer.js');
replaceAlerts('Akt generator/ImportRoot.js');
replaceAlerts('Akt generator/Monitoring.js');
replaceAlerts('Akt generator/Supabase.js');
console.log('Replaced alerts with returns');
