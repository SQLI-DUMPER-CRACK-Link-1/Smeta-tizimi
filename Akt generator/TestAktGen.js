function forceRunAktGeneration() {
  try {
    var prompt = "qara tepadagi 2 ta aktda adashibmanda, bunda -2.4 otmetkagacha fbs terib monolit uchastkalar quyilishidan oldin km-1-2-3 kolonnalar quyilishi kerak ekan, bunda birinchi 20-12-14 dan asosiy va 6lik armaturadan xomut va qo'shimchalar to'qilib keyin opalubka montaj qilinib b20 dan beton qilinishi kerak ekan jigar. ana undan keyin fbs montaj qilinib -2.4 otmetkagacha, keyin op-1 qilinar ekan obvyazochniy poyas, bunda 12 va 6 lik armaturalardan foydalanilib b15 dan quyiladi, keyin fbs va kolonnalar oralig'ida qolgan joylar uchun ham monolit uchastkalari quyiladi va fbs va kolonnalarni birga bog'lash uchun kr-1 setka ham qo'yilib ketilishi kerak, yo'q bu kr-1 eshik va derazalar ustiga xuddi peremichka day dopolnitelniy armatura bo'lar ekan, kolonna va fbs ni bog'lashda esa sg-1 6 lik setkadan tashlangan ekan, op-1 qilingandan keyin yana 2 qator fbs lari -2.2 otmetkadan -0.7 otmetkagacha terilib monolit uchastkalari qilinib kolonnalar bilan sg setka bilan bog'lanishlari bilan qilingan monolit uchastkalari, opalubka...";
    
    var res = askTitanAiForAct(prompt, [], "2026-05-12", "GAME ZONA");
    Logger.log(JSON.stringify(res, null, 2));
  } catch(e) {
    Logger.log("Error: " + e.message);
  }
}
