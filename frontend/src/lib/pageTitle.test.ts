import { describe, expect, it } from 'vitest';
import { APP_TITLE, titleForPath } from './pageTitle';
describe('browser page identity', () => {
  it.each([['/admin','Rahbar paneli | SMETA TIZIM 02'],['/admin/dashboard','Rahbar paneli | SMETA TIZIM 02'],['/admin/documents','Hujjatlar | SMETA TIZIM 02'],['/admin/storage','Fayl saqlash | SMETA TIZIM 02'],['/admin/test/saqlash','Fayl saqlash | SMETA TIZIM 02'],['/admin/mindmap','Mindmap | SMETA TIZIM 02'],['/admin/participants','Loyiha ishtirokchilari | SMETA TIZIM 02'],['/admin/system-control','Tizim boshqaruv markazi | SMETA TIZIM 02']])('maps %s', (path, expected) => expect(titleForPath(path)).toBe(expected));
  it('uses product title for unknown routes', () => expect(titleForPath('/')).toBe(APP_TITLE));
});
