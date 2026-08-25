export async function uploadFayl(file: File) {
  const formData = new FormData();
  formData.append('fayl', file);
  
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  return await res.json();
}
