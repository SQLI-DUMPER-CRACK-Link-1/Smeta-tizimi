export const APP_TITLE = 'SMETA TIZIM 02';
const titles: Array<[RegExp, string]> = [
  [/^\/admin\/storage(?:\/|$)/, 'Fayl saqlash'], [/^\/admin\/(?:test\/)?saqlash(?:\/|$)/, 'Fayl saqlash'],
  [/^\/admin\/mindmap(?:\/|$)/, 'Mindmap'], [/^\/admin\/(?:test\/)?xarita(?:\/|$)/, 'Mindmap'],
  [/^\/admin\/participants(?:\/|$)/, 'Loyiha ishtirokchilari'], [/^\/admin\/(?:system-control|control)(?:\/|$)/, 'Tizim boshqaruv markazi'],
  [/^\/admin\/documents(?:\/|$)/, 'Hujjatlar'], [/^\/admin\/dashboard(?:\/|$)/, 'Rahbar paneli'],
  [/^\/admin(?:\/|$)/, 'Rahbar paneli'],
];
export function titleForPath(pathname: string): string { const match = titles.find(([pattern]) => pattern.test(pathname)); return match ? `${match[1]} | ${APP_TITLE}` : APP_TITLE; }
