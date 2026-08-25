export async function tolovniBoshla(shartnomaId: number, summa: number) {
  // Haqiqiy hayotda bu yerda to'lov shlyuziga (Payme/Click) yo'naltirish URli shakllanadi.
  return {
    ok: true,
    redirect_url: 'https://checkout.paycom.uz/' + btoa('m=123;ac.shartnoma=' + shartnomaId + ';a=' + summa * 100)
  };
}
