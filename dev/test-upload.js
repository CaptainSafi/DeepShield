const fs = require('node:fs');

async function testUpload() {
  const spaceUrl = 'https://jabrave-deepfake-api.hf.space';
  
  // Create a dummy text/png file content or use a real file if exists
  // Let's use a dummy text file to test the upload endpoint
  fs.writeFileSync('scratch/dummy.png', 'fake image content');

  const form = new FormData();
  // Node 18+ has global FormData
  const fileBlob = new Blob([fs.readFileSync('scratch/dummy.png')], { type: 'image/png' });
  form.append('files', fileBlob, 'dummy.png');

  console.log('Sending upload request...');
  const res = await fetch(`${spaceUrl}/gradio_api/upload`, {
    method: 'POST',
    body: form
  });

  if (!res.ok) {
    console.error('Upload failed:', res.status, await res.text());
    return;
  }

  const responseJson = await res.json();
  console.log('Upload response:', responseJson);
}

testUpload().catch(console.error);
