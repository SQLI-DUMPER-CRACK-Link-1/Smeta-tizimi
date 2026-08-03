const n = '(-?\\d+(?:\\s\\d{3})*(?:\\.\\d+)?)';
const amtRegex = new RegExp(
    n + '\\s+' + // Miqdor
    n + '\\s+' + // Narx
    n + '\\s+' + // Jami NDS siz
    '(?:(?:Без\\s*акциз(?:а|сиз)|Акцизсиз|\\d+\\s*%)\\s+' + n + '\\s+)?' + // Optional Aksiz
    '(\\d+\\s*%|Без\\s*НДС|ҚҚСсиз|Без\\s*НДС\\s*\\(0\\)|ҚҚСсиз\\s*\\(0\\))\\s+' + // NDS stavka
    n + '\\s+' + // NDS Summa
    n + // Jami
    '(?:\\s+(?:Олди-сотди|Ўз\\.иш\\.чиқ\\.|Импорт|Четдан келтирилган|Ўз эҳтиёжлари учун ишлаб чиқарилган))?',
    'gi'
);

function parse(text) {
    let match;
    let results = [];
    let r = new RegExp(amtRegex.source, amtRegex.flags);
    while ((match = r.exec(text)) !== null) {
        results.push(match.slice(1, 8));
    }
    return results;
}

console.log('1:', parse('ming dona 19.250000 1 159 554.73 22 321 428.57 12% 2 678 571.43 25 000 000.00'));
console.log('2:', parse('0.107000 11 250 000.00 1 203 750.00 12% 144 450.00 1 348 200.00 -'));
console.log('3:', parse('214.000000 50 000.00 10 700 000.00 12% 1 284 000.00 11 984 000.00'));
console.log('4:', parse('08433001021000000 -   . 2.000000 3 645 000.00 7 290 000.00 12% 874 800.00 8 164 800.00 -'));
