

async function test() {
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxKOoTacSJaiKd5nPqa38letjjWJUvqy6vLcqkXnM78_jPRT_HobktQNQAEl-XXK2n4aQ/exec'; 
  
  try {
    const r = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ 
        __api: 1, 
        token: "test", 
        fn: "apiDiagnostikaOcr", 
        args: ["Ҳисоб_фактура_актсиз_663_15_12_2025_дан.pdf"] 
      }),
      redirect: 'follow'
    });

    const text = await r.text();
    console.log("Status:", r.status);
    console.log("Response text:", text);
  } catch(e) {
    console.error("Fetch failed:", e);
  }
}

test();
