const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const docx = require('docx');
const { Document, Table, TableRow, TableCell, Paragraph, TextRun, ImageRun, WidthType, AlignmentType, HeadingLevel, Packer } = docx;

// Data definitions
const imageDir = `C:\\Users\\PC\\.gemini\\antigravity\\brain\\e798c476-f670-4605-ab2a-a12a3a4ed136`;

const items = [
  {
    name: "КОМПЛЕКТ ДЛЯ САНУЗЛА ИНВАЛИДОВ /ПОРУЧНИ СКЛАДНОЙ ПОРУЧЕНЬ ПИКТОГРАММА П ОБРАЗНЫЙ РУЧКИ ДЛЯ ДВЕРЕЙ КНОПКИ ВЫЗОВА ПОМОЩИ ТАКТИЛЬНАЯ НАПЛАВЛЯЮЩАЯ ПОЛОСА//СЕРТИФИЦИРОВАННЫЙ ПРОИЗВОДИТЕЛЬ/",
    unit: "К-Т",
    qty: 4,
    object: "Амфитеатр",
    price: 2200892.85,
    filename: "bathroom_kit_1786893745765.jpg"
  },
  {
    name: "КНОПКА ВЫЗОВА ПОМОЩИ СЕНСОРНАЯ+ПРЁМНИК/СЕРТИФИЦИРОВАННЫЙ ПРОИЗВОДИТЕЛЬ/",
    unit: "комп",
    qty: 4,
    object: "Амфитеатр",
    price: 1096785.71,
    filename: "call_button_1786893355175.jpg"
  },
  {
    name: "КРЮЧОК ДЛЯ КОСТЫЛЕЙ/СЕРТИФИЦИРОВАННЫЙ ПРОИЗВОДИТЕЛЬ/",
    unit: "ШТ",
    qty: 4,
    object: "Амфитеатр",
    price: 54857.14,
    filename: "crutch_hook_1786890047824.jpg"
  },
  {
    name: "МНЕМОСХЕМА САНУЗЛА 300Х400ММ МАТЕРИАЛ КОМПОЗИТ/СЕРТИФИЦИРОВАННЫЙ ПРОИЗВОДИТЕЛЬ/",
    unit: "ШТ",
    qty: 2,
    object: "Амфитеатр",
    price: 1165816.60,
    filename: "mnemoscheme_1786890090875.jpg"
  },
  {
    name: "ТАКТИЛЬНАЯ ПИКТОГРАММА,МАТЕРИАЛ ПВХ,150Х150ММ/СЕРТИФИЦИРОВАННЫЙ ПРОИЗВОДИТЕЛЬ/",
    unit: "ШТ",
    qty: 12,
    object: "Амфитеатр",
    price: 51958.40,
    filename: "pictogram_150_1786890110701.jpg"
  },
  {
    name: "ТАКТИЛЬНАЯ ПИКТОГРАММА,МАТЕРИАЛ ПВХ,150Х200ММ/СЕРТИФИЦИРОВАННЫЙ ПРОИЗВОДИТЕЛЬ/",
    unit: "ШТ",
    qty: 4,
    object: "Амфитеатр",
    price: 97422.00,
    filename: "pictogram_200_1786893626496.jpg"
  },
  {
    name: "ПРОФИЛЬ АЛЮМИНИЕВЫЙ С ПРОТИВОСКОЛЬЗЯЩЕЙ ВСТАВКОЙ,1300х100ММ/СЕРТИФИЦИРОВАННЫЙ ПРОИЗВОДИТЕЛЬ/",
    unit: "ШТ",
    qty: 8,
    object: "Амфитеатр",
    price: 135711.00,
    filename: "aluminum_profile_1786890155344.jpg"
  },
  {
    name: "КОМПЛЕКТ САН.УЗЛА ДЛЯ ИНВАЛИДОВ/ПОРУЧЕНЬ U-ОБРАЗНЫЙ ОТКИДНОЙ,НЕРЖ.СТАЛЬ,ДИАМЕТР 32,600ММ,ПОРУЧЕНЬ ДЛЯ РАКОВИНЫ ППС-4 НЕРЖ. СТАЛЬ,ДИАМЕТР 38,ПОРУЧЕНЬ ПРЯМОЙ СТАЦИОНАРНЫЙ ,НЕРЖ. СТАЛЬ,ДИАМЕТР 32,600ММ,КРЮЧОК ДЛЯ ОДЕЖДЫ./",
    unit: "К-Т",
    qty: 4,
    object: "Амфитеатр",
    price: 2465000.00,
    filename: "grab_rails_set_1786890180193.jpg"
  },
  {
    name: "КОМПЛЕКТ ДЛЯ САНУЗЛА ИНВАЛИДОВ (ПОРУЧНИ U-ОБРАЗНЫЙ ОТКИДНОЙ НЕР. СТАЛЬ ДИАМЕТРОМ 32, 600 ММ ПОРУЧЕНЬ ДЛЯ РАКОВИНЫ ППС-4 НЕРЖ СТАЛЬ ДИАМЕТРОМ 38; ПОРУЧЕНЬ ПРЯМОЙ СТАЦИОНАРНЫЙ НЕР. СТАЛЬ ДИАМЕТРОМ 32, 600ММ КРЮЧОК ДЛЯ ОДЕЖДЫ П ОБРАЗНЫЕ РУЧКИ ДЛЯ ДВЕРЕЙ)(СЕРТИФИЦИРОВАННЫЙ ПРОИЗВОДИТЕЛЬ)",
    unit: "К-Т",
    qty: 4,
    object: "Туалет 4шт",
    price: 3631250.00,
    filename: "grab_rails_set_1786890180193.jpg"
  }
];

// Calculate totals
items.forEach(item => {
  item.total = item.qty * item.price;
  item.imagePath = path.join(imageDir, item.filename);
});

const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

// -------------------------------------------------------------
// EXCEL GENERATION
// -------------------------------------------------------------
async function generateExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Смета с изображениями');

  worksheet.views = [{ showGridLines: true }];

  worksheet.columns = [
    { header: 'Фото', key: 'photo', width: 28 },
    { header: 'Наименование', key: 'name', width: 55 },
    { header: 'Ед. изм.', key: 'unit', width: 12 },
    { header: 'Кол-во', key: 'qty', width: 10 },
    { header: 'Объект', key: 'object', width: 15 },
    { header: 'Цена за ед. (UZS)', key: 'price', width: 20 },
    { header: 'Общая сумма (UZS)', key: 'total', width: 22 }
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell(cell => {
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' }
    };
  });

  items.forEach((item, index) => {
    const rowIndex = index + 2;
    const row = worksheet.getRow(rowIndex);
    row.height = 100;

    row.getCell('name').value = item.name;
    row.getCell('unit').value = item.unit;
    row.getCell('qty').value = item.qty;
    row.getCell('object').value = item.object;
    row.getCell('price').value = item.price;
    row.getCell('total').value = { formula: `D${rowIndex}*F${rowIndex}` };

    row.getCell('name').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    row.getCell('unit').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('qty').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('object').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('price').alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell('total').alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell('price').numFmt = '#,##0.00';
    row.getCell('total').numFmt = '#,##0.00';

    row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { name: 'Arial', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      };
    });

    if (fs.existsSync(item.imagePath)) {
      const imageId = workbook.addImage({
        filename: item.imagePath,
        extension: 'jpeg',
      });
      
      worksheet.addImage(imageId, {
        tl: { col: 0, row: rowIndex - 1, xOffset: 12, yOffset: 12 },
        ext: { width: 140, height: 105 }
      });
    }
  });

  const totalRowIndex = items.length + 2;
  const totalRow = worksheet.getRow(totalRowIndex);
  totalRow.height = 25;
  totalRow.getCell('name').value = 'ИТОГО:';
  totalRow.getCell('name').font = { name: 'Arial', bold: true, size: 11 };
  totalRow.getCell('name').alignment = { vertical: 'middle', horizontal: 'right' };
  
  totalRow.getCell('total').value = { formula: `SUM(G2:G${totalRowIndex - 1})` };
  totalRow.getCell('total').font = { name: 'Arial', bold: true, size: 11 };
  totalRow.getCell('total').numFmt = '#,##0.00';
  totalRow.getCell('total').alignment = { vertical: 'middle', horizontal: 'right' };

  totalRow.eachCell({ includeEmpty: true }, cell => {
    cell.border = {
      top: { style: 'double', color: { argb: 'FF000000' } },
      bottom: { style: 'double', color: { argb: 'FF000000' } }
    };
  });

  const outPath = path.join(__dirname, '..', 'Jihozlar_Smetasi_Yangi.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log(`Excel file created successfully at: ${outPath}`);
}

// -------------------------------------------------------------
// WORD GENERATION
// -------------------------------------------------------------
async function generateWord() {
  const tableRows = [];

  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Фото", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { fill: "1F4E78" },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Наименование товара / услуги", bold: true, color: "FFFFFF" })] })],
          width: { size: 40, type: WidthType.PERCENTAGE },
          shading: { fill: "1F4E78" },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Ед. изм.", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: { fill: "1F4E78" },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Кол-во", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: { fill: "1F4E78" },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Сумма (UZS)", bold: true, color: "FFFFFF" })], alignment: AlignmentType.RIGHT })],
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { fill: "1F4E78" },
        }),
      ],
    })
  );

  items.forEach(item => {
    const imgBuffer = fs.existsSync(item.imagePath) ? fs.readFileSync(item.imagePath) : null;
    const cellChildren = [];

    if (imgBuffer) {
      cellChildren.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imgBuffer,
              transformation: {
                width: 120,
                height: 90,
              },
            }),
          ],
          alignment: AlignmentType.CENTER,
        })
      );
    } else {
      cellChildren.push(new Paragraph({ text: "[Нет фото]", alignment: AlignmentType.CENTER }));
    }

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: cellChildren, verticalAlign: AlignmentType.CENTER }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: item.name, size: 20 })],
              }),
              new Paragraph({
                children: [new TextRun({ text: `Объект: ${item.object}`, size: 16, italics: true, color: "555555" })],
              })
            ],
            verticalAlign: AlignmentType.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ text: item.unit, alignment: AlignmentType.CENTER })],
            verticalAlign: AlignmentType.CENTER
          }),
          new TableCell({
            children: [new Paragraph({ text: item.qty.toString(), alignment: AlignmentType.CENTER })],
            verticalAlign: AlignmentType.CENTER
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: item.total.toLocaleString('ru-RU', { minimumFractionDigits: 2 }), size: 18 })],
                alignment: AlignmentType.RIGHT,
              }),
              new Paragraph({
                children: [new TextRun({ text: `ед: ${item.price.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`, size: 14, color: "777777" })],
                alignment: AlignmentType.RIGHT,
              })
            ],
            verticalAlign: AlignmentType.CENTER
          }),
        ],
      })
    );
  });

  tableRows.push(
    new TableRow({
      children: [
        new TableCell({ children: [] }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "ИТОГО:", bold: true })], alignment: AlignmentType.RIGHT })],
          columnSpan: 3,
          verticalAlign: AlignmentType.CENTER
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: grandTotal.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) + " UZS", bold: true })], alignment: AlignmentType.RIGHT })],
          verticalAlign: AlignmentType.CENTER
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "СПЕЦИФИКАЦИЯ ОБОРУДОВАНИЯ С ФОТОГРАФИЯМИ",
                bold: true,
                size: 28,
                color: "1F4E78",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Каталог оборудования для обеспечения доступности санузлов инвалидов",
                italics: true,
                size: 20,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),
          new Table({
            rows: tableRows,
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
          }),
        ],
      },
    ],
  });

  const outPath = path.join(__dirname, '..', 'Jihozlar_Katalogi_Yangi.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log(`Word document created successfully at: ${outPath}`);
}

async function main() {
  try {
    await generateExcel();
    await generateWord();
    console.log("All files generated successfully!");
  } catch (error) {
    console.error("Error generating files:", error);
    process.exit(1);
  }
}

main();
