export async function sbDidoxHarakat(amal: string) {
  const res = await fetch('/api/didox-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: amal })
  });
  return await res.json();
}
