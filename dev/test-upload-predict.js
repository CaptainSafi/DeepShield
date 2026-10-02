const fs = require('node:fs');

async function testUploadPredict() {
  const spaceUrl = 'https://jabrave-deepfake-api.hf.space';
  
  // Let's create a tiny real test image (a 1x1 transparent PNG)
  // 1x1 pixel PNG Base64
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const imgBuffer = Buffer.from(pngBase64, 'base64');
  fs.writeFileSync('scratch/test.png', imgBuffer);

  const form = new FormData();
  const fileBlob = new Blob([imgBuffer], { type: 'image/png' });
  form.append('files', fileBlob, 'test.png');

  console.log('Uploading image...');
  const uploadRes = await fetch(`${spaceUrl}/gradio_api/upload`, {
    method: 'POST',
    body: form
  });

  if (!uploadRes.ok) {
    console.error('Upload failed:', uploadRes.status, await uploadRes.text());
    return;
  }

  const uploadResult = await uploadRes.json();
  console.log('Upload result:', uploadResult);
  const serverPath = uploadResult[0];

  console.log('Sending predict request with uploaded file path:', serverPath);
  const predictRes = await fetch(`${spaceUrl}/gradio_api/call/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        path: serverPath,
        meta: { _type: 'gradio.FileData' },
        orig_name: 'test.png'
      }]
    })
  });

  if (!predictRes.ok) {
    console.error('Predict POST failed:', predictRes.status, await predictRes.text());
    return;
  }

  const { event_id } = await predictRes.json();
  console.log('Got event_id:', event_id);

  console.log('Opening event stream...');
  const streamRes = await fetch(`${spaceUrl}/gradio_api/call/predict/${event_id}`);
  if (!streamRes.ok) {
    console.error('Stream failed:', streamRes.status);
    return;
  }

  const reader = streamRes.body;
  if (!reader) {
    console.error('No reader');
    return;
  }

  // Read response stream
  let buffer = '';
  for await (const chunk of reader) {
    const text = chunk.toString();
    console.log('CHUNK:', text);
  }
}

testUploadPredict().catch(console.error);
