const fs = require('fs');

let adminShell = fs.readFileSync('frontend/src/admin/AdminShell.tsx', 'utf8');

if (!adminShell.includes('/admin/test/smeta')) {
    adminShell = adminShell.replace(
        "{ yol: '/admin/test/moliya', nom: 'Moliya va Shartnomalar', Ikonka: Briefcase },",
        "{ yol: '/admin/test/smeta', nom: 'Smeta va F2 Import', Ikonka: FileInput },\n        { yol: '/admin/test/moliya', nom: 'Moliya va Shartnomalar', Ikonka: Briefcase },"
    );
    // Let's also make sure PTO can see it
    adminShell = adminShell.replace(
        "if (g.id === 'operatsion') allowedMenus = allowedMenus.filter(m => m.yol.includes('moliya'));",
        "if (g.id === 'operatsion') allowedMenus = allowedMenus.filter(m => m.yol.includes('moliya') || m.yol.includes('smeta'));"
    );
    // For Bugalter too just in case
    adminShell = adminShell.replace(
        "if (g.id === 'operatsion') allowedMenus = allowedMenus.filter(m => m.yol.includes('moliya'));",
        "if (g.id === 'operatsion') allowedMenus = allowedMenus.filter(m => m.yol.includes('moliya') || m.yol.includes('smeta'));"
    );
    
    fs.writeFileSync('frontend/src/admin/AdminShell.tsx', adminShell);
}
