// fetch is globally available

async function testImage() {
  const spaceUrl = 'https://jabrave-deepfake-api.hf.space';
  const imgUrl = 'https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png';

  console.log('Sending predict request...');
  const res = await fetch(`${spaceUrl}/gradio_api/call/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        path: imgUrl,
        meta: { _type: 'gradio.FileData' },
        orig_name: 'bus.png',
        url: imgUrl
      }]
    })
  });

  if (!res.ok) {
    console.error('Post failed:', res.status, await res.text());
    return;
  }

  const { event_id } = await res.json();
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
    buffer += chunk.toString();
    console.log('CHUNK:', chunk.toString());
  }
}

testImage().catch(console.error);
