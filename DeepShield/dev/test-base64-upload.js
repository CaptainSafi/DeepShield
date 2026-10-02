const fs = require('node:fs');

async function testBase64Upload() {
  const spaceUrl = 'https://jabrave-deepfake-api.hf.space';
  
  // Use a transparent 1x1 png image
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const dataUrl = `data:image/png;base64,${pngBase64}`;

  console.log('Decoding data URL via fetch...');
  const response = await fetch(dataUrl);
  const fileBlob = await response.blob();
  console.log('Blob size:', fileBlob.size, 'type:', fileBlob.type);

  const form = new FormData();
  form.append('files', fileBlob, 'uploaded_test.png');

  console.log('Uploading image to Gradio...');
  const uploadRes = await fetch(`${spaceUrl}/gradio_api/upload`, {
    method: 'POST',
    body: form
  });

  if (!uploadRes.ok) {
    console.error('Upload failed:', uploadRes.status, await uploadRes.text());
    return;
  }

  const uploadResult = await uploadRes.json();
  console.log('Upload result server path:', uploadResult[0]);
  const serverPath = uploadResult[0];

  console.log('Running predict...');
  const predictRes = await fetch(`${spaceUrl}/gradio_api/call/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        path: serverPath,
        meta: { _type: 'gradio.FileData' },
        orig_name: 'uploaded_test.png'
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

testBase64Upload().catch(console.error);
