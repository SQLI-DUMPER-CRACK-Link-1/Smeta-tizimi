import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('T2 kundalik PTO navigatsiyasi', () => {
  const shell = readFileSync(resolve(process.cwd(), 'src', 'admin', 'AdminShell.tsx'), 'utf8');
  const eski = shell.slice(shell.indexOf('const ESKI_TIZIM_MENYU'), shell.indexOf('export default function AdminShell'));
  const operatsion = shell.slice(shell.indexOf("nom: 'Operatsion Boshqaruv'"), shell.indexOf("nom: 'Sozlama'"));

  it('native F2 yo‘llari eski Tizim_01 menyusida takrorlanmaydi', () => {
    expect(eski).not.toContain("'/admin/f2'");
    expect(eski).not.toContain("'/admin/f2-tayyorlash'");
  });

  it('native LRV va F2 yo‘llari operatsion T2 guruhida turadi', () => {
    expect(operatsion).toContain("{ yol: '/admin/holat'");
    expect(operatsion).toContain("{ yol: '/admin/f2'");
    expect(operatsion).toContain("{ yol: '/admin/f2-tayyorlash'");
  });

  it('development /admin/test yo‘llari production sidebarida ko‘rinmaydi', () => {
    expect(shell).not.toMatch(/yol:\s*['"]\/admin\/test\//);
  });

  it('native obyekt yo‘li eski Tizim_01 menyusida takrorlanmaydi', () => {
    expect(eski).not.toContain("'/admin/obyektlar'");
    expect(shell.slice(0, shell.indexOf('const ESKI_TIZIM_MENYU'))).toContain("{ yol: '/admin/obyektlar'");
  });
});
