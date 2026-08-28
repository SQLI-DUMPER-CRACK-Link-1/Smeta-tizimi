const fs = require('fs');
const path = require('path');

const files = ['TestBirja.tsx', 'TestErp.tsx', 'TestInvite.tsx', 'TestKontragent.tsx', 'TestShartnoma.tsx', 'TestSklad.tsx', 'TestSozlama.tsx', 'TestTizim.tsx', 'TestTolov.tsx', 'TestXarita.tsx'];

files.forEach(f => {
    const p = path.join('frontend', 'src', 'test02', f);
    if (!fs.existsSync(p)) return;
    
    let content = fs.readFileSync(p, 'utf8');
    
    // Remove ALL import statements (crude but works if they match this pattern)
    content = content.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\r?\n/gm, '');
    
    // Find JSX elements
    const tagRegex = /<([A-Z][a-zA-Z0-9]*)\b/g;
    let lucide_matches = new Set();
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
        const tag = match[1];
        if (tag !== 'FmtN' && tag !== 'React' && tag !== 'Map' && tag !== 'Placemark' && tag !== 'ZoomControl' && tag !== 'YMaps') {
            lucide_matches.add(tag);
        }
    }
    
    let imports = [
        "import React, { useState, useEffect, useRef, useCallback } from 'react';",
        "import { useSearchParams } from 'react-router-dom';",
        "import { useKompaniya } from './KompaniyaTanlov';"
    ];
    
    if (content.includes('FmtN')) imports.push("import { FmtN } from '../lib/format';");
    if (content.includes('toast')) imports.push("import { toast } from '../umumiy/ui/Toast';");
    
    // Some manual db imports if needed
    if (content.includes('sbErpDashboardOl')) imports.push("import { sbErpDashboardOl } from '../api/t2-erp';");
    if (content.includes('sbTizimLoglari')) imports.push("import { sbTizimLoglari, type AuditLog } from '../api/t2-tizim';");
    if (content.includes('sbSozlamaOl')) imports.push("import { sbSozlamaOl, sbSozlamaSaqla } from '../api/t2-sozlamalar';");
    
    if (f === 'TestXarita.tsx') imports.push("import { YMaps, Map, Placemark, ZoomControl } from '@pbe/react-yandex-maps';");
    
    if (lucide_matches.size > 0) {
        imports.push(`import { ${Array.from(lucide_matches).join(', ')} } from 'lucide-react';`);
    }
    
    content = content.replace(/^\s+/, '');
    const final_content = imports.join('\n') + '\n\n' + content;
    
    fs.writeFileSync(p, final_content, 'utf8');
});
