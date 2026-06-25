/********************************************************************
 * 01_Sozlamalar.gs — SOZLAMA VARAQLARINI YASASH
 * ------------------------------------------------------------------
 * 2 ta varaq:
 *   SOZLAMALAR             — ROOT papka ID + global parametrlar
 *   SOZLAMALAR_KATEGORIYA  — svod bloklari, kalit so'zlar, override
 *
 * MUHIM: har obyekt uchun alohida qator YO'Q — tizim ROOT papkadan
 *        sub-papkalarni avtomat topadi (sub-papka nomi = obyekt nomi).
 ********************************************************************/

function sozlamalarYarat(){
  var ss = SpreadsheetApp.getActive();

  /* ---------- 1) SOZLAMALAR (global) ---------- */
  var s1 = ss.getSheetByName(CFG.SOZ);
  if(s1){ if(!_tasdiq(CFG.SOZ+' bor. Qayta yasalsinmi? (mavjud qiymatlar o\'chadi)')) return; ss.deleteSheet(s1); }
  s1 = ss.insertSheet(CFG.SOZ);

  var rows1 = [
    ['ПАРАМЕТР',        'ҚИЙМАТ',                        'ИЗОҲ'],
    ['ROOT_FOLDER_ID',  '',                              'Асосий папка ID — ичида ҳар объект учун sub-папка'],
    ['SVOD_BLOK',       1,                               'Свод: блок сарлавҳа устуни (A=1) — ЧЕЛ/МАШ/МАТ ажратувчи'],
    ['SVOD_NOM',        2,                               'Свод: ресурс номи устуни (B=2)'],
    ['SVOD_NARX',       5,                               'Свод: нарх устуни (E=5)'],
    ['DATA_QATOR',      0,                               'Локалка маълумот қатори. 0 = АВТО аниқлаш'],
    ['NARX_MANTIQ',     'MAX',                           'MAX=смета/факт қайси қиммат / SVOD=доим свод'],
    ['SERVER_ID',       '',                              'Марказий DASHBOARD файл ID. Бўш = ROOT папкада авто яратилади']
  ];
  s1.getRange(1,1,rows1.length,3).setValues(rows1);
  s1.getRange(1,1,1,3).setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
  s1.getRange(2,1,rows1.length-1,1).setFontWeight('bold');
  s1.getRange('B2').setBackground('#fff2cc');          // ROOT_FOLDER_ID — to'ldirilishi shart
  s1.setColumnWidth(1,170); s1.setColumnWidth(2,360); s1.setColumnWidth(3,520);
  s1.setFrozenRows(1);

  /* ---------- 2) SOZLAMALAR_KATEGORIYA ---------- */
  var s2 = ss.getSheetByName(CFG.SOZ_KAT);
  if(s2) ss.deleteSheet(s2);
  s2 = ss.insertSheet(CFG.SOZ_KAT);

  var rows2 = [
    ['ТУР',         'ҚИЙМАТ / КАЛИТ СЎЗ',                                  'НАРХ',   'КАТ'],
    ['BLOK_CHEL',   'ЗАТРАТЫ ТРУДА',                                       '',       ''],
    ['BLOK_MASH',   'СТРОИТЕЛЬНЫЕ МАШИНЫ',                                  '',       ''],
    ['BLOK_MAT',    'СТРОИТЕЛЬНЫЕ МАТЕРИАЛЫ',                               '',       ''],
    ['BLOK_OB',     'ОБОРУДОВАНИЕ',                                         '',       ''],
    ['KW_KAB',      'КАБЕЛ,ПРОВОД,ВВГ,КВВ,АВВ,АВВГ,ВВГНГ,КГ',              '',       ''],
    ['KW_MK',       'БАЛК,ШВЕЛЛЕР,УГОЛОК,ДВУТАВР,АРМАТУР,ЛИСТОВАЯ,ПРОФНАСТ,ТРУБА ЭЛЕКТРОСВАР', '', ''],
    ['KW_OB',       'ОБОРУДОВАН,НАСОС,ВЕНТИЛЯТОР,АГРЕГАТ,ТРАНСФОРМАТОР,ДВИГАТЕЛЬ', '',  ''],
    ['KW_STOP',     'ГОСТ,ТУ,ДЛЯ,И,В,НА,ИЗ,ПО,СО,ШТ,МАРКИ,ТИПА',          '',       ''],
    ['OVERRIDE',    'ЗАТРАТЫ ТРУДА РАБОЧИХ',                                24517.7,  'ЧЕЛ'],
    ['OVERRIDE',    'ЗАТРАТЫ ТРУДА МАШИНИСТОВ',                             0,        'МАШ']
  ];
  s2.getRange(1,1,rows2.length,4).setValues(rows2);
  s2.getRange(1,1,1,4).setFontWeight('bold').setBackground('#2e75b5').setFontColor('#ffffff');
  s2.getRange(2,1,rows2.length-1,1).setFontWeight('bold');
  s2.setColumnWidth(1,130); s2.setColumnWidth(2,620); s2.setColumnWidth(3,90); s2.setColumnWidth(4,70);
  s2.setFrozenRows(1);

  /* ---------- 3) SOZLAMALAR_ҚУЛФ (lock tizimi uchun) ---------- */
  if(!ss.getSheetByName(CFG.SOZ_LOCK)){
    var sL=ss.insertSheet(CFG.SOZ_LOCK);
    sL.getRange(1,1,1,4).setValues([['ОБЪЕКТ','ҲОЛАТ','САНА','ИЗОҲ']])
      .setFontWeight('bold').setBackground('#7f3d3d').setFontColor('#ffffff');
    sL.setColumnWidth(1,250); sL.setColumnWidth(2,110); sL.setColumnWidth(3,150); sL.setColumnWidth(4,380);
    sL.setFrozenRows(1);
  }

  ss.setActiveSheet(s1);
  SpreadsheetApp.getUi().alert(
    'Sozlama varaqlari yaratildi.\n\n' +
    '1) SOZLAMALAR → ROOT_FOLDER_ID (sariq katak) ga asosiy papka ID sini yoz.\n' +
    '   (papka ichida: Амфитеатр/, Стелла/ ... har birida lokalka+svodka)\n\n' +
    '2) SOZLAMALAR_KATEGORIYA → kerak bo\'lsa svod blok nomlari/kalit so\'zlarni tuzat.\n\n' +
    'Keyin menyu → "② Папкани ўқи ва LRV_PLUS яса".'
  );
}

function _tasdiq(msg){
  var ui=SpreadsheetApp.getUi();
  return ui.alert('Tasdiqlang', msg, ui.ButtonSet.YES_NO)===ui.Button.YES;
}

/* Panel ichidan: alert'siz, mavjud bo'lmasa yaratadi (qiymatlarni o'chirmaydi) */
function sozlamalarYaratSilent(){
  var ss=SpreadsheetApp.getActive();
  if(!ss.getSheetByName(CFG.SOZ)){
    var s1=ss.insertSheet(CFG.SOZ);
    var r1=[['ПАРАМЕТР','ҚИЙМАТ','ИЗОҲ'],
      ['ROOT_FOLDER_ID','','Асосий папка ID'],
      ['SVOD_BLOK',1,'Свод блок устуни'],
      ['SVOD_NOM',2,'Свод ном устуни'],
      ['SVOD_NARX',5,'Свод нарх устуни'],
      ['DATA_QATOR',0,'0 = АВТО'],
      ['NARX_MANTIQ','MAX','MAX/SVOD'],
      ['SERVER_ID','','Бўш = авто']];
    s1.getRange(1,1,r1.length,3).setValues(r1);
    s1.getRange(1,1,1,3).setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
    s1.setFrozenRows(1);
  }
  if(!ss.getSheetByName(CFG.SOZ_KAT)){
    var s2=ss.insertSheet(CFG.SOZ_KAT);
    var r2=[['ТУР','ҚИЙМАТ / КАЛИТ СЎЗ','НАРХ','КАТ'],
      ['BLOK_CHEL','ЗАТРАТЫ ТРУДА','',''],
      ['BLOK_MASH','СТРОИТЕЛЬНЫЕ МАШИНЫ','',''],
      ['BLOK_MAT','СТРОИТЕЛЬНЫЕ МАТЕРИАЛЫ','',''],
      ['BLOK_OB','ОБОРУДОВАНИЕ','',''],
      ['KW_KAB','КАБЕЛ,ПРОВОД,ВВГ,КВВ,АВВ,АВВГ,ВВГНГ,КГ','',''],
      ['KW_MK','БАЛК,ШВЕЛЛЕР,УГОЛОК,ДВУТАВР,АРМАТУР,ЛИСТОВАЯ,ПРОФНАСТ','',''],
      ['KW_OB','ОБОРУДОВАН,НАСОС,ВЕНТИЛЯТОР,АГРЕГАТ,ТРАНСФОРМАТОР,ДВИГАТЕЛЬ,КОНДИЦИОНЕР,ДИФФУЗОР,ЧИЛЛЕР,ФАНКОЙЛ,КОТЕЛ,КОТЁЛ,ГОРЕЛКА,НАСОСН,КОМПРЕССОР,ХОЛОДИЛЬН,ТЕПЛООБМЕННИК,ЭЛЕКТРОДВИГ,ГЕНЕРАТОР,ЭЛЕКТРОСТАНЦ,УЗО,АВТОМАТ,ЩИТОК,ЩИТОВОЙ,ПАНЕЛЬ УПРАВ,ЧАСТОТН ПРЕОБРАЗ','',''],
      ['KW_STOP','ГОСТ,ТУ,ДЛЯ,И,В,НА,ИЗ,ПО,СО,ШТ,МАРКИ,ТИПА','',''],
      ['OVERRIDE','ЗАТРАТЫ ТРУДА РАБОЧИХ',24517.7,'ЧЕЛ'],
      ['OVERRIDE','ЗАТРАТЫ ТРУДА МАШИНИСТОВ',0,'МАШ']];
    s2.getRange(1,1,r2.length,4).setValues(r2);
    s2.getRange(1,1,1,4).setFontWeight('bold').setBackground('#2e75b5').setFontColor('#ffffff');
    s2.setFrozenRows(1);
  }
}
