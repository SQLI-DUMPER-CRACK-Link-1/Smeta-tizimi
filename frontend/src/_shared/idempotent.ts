/**
 * Idempotentlik (Takroriylikdan himoya) moduli.
 * Har bir backend mutatsiyasi uchun noyob identifikator yaratib beradi.
 * Bu orqali tarmoq muammolari tufayli so'rov takrorlansa ham backend
 * uni 2-marta qo'shib yubormaydi.
 */

export function yangiUid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback (eski brauzerlar uchun)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
