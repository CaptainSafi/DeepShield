async function testFetchDataUrl() {
  const dataUrl = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
  const res = await fetch(dataUrl);
  const text = await res.text();
  console.log('Decoded text:', text);
}

testFetchDataUrl().catch(console.error);
