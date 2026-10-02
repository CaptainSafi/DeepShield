async function testVideo() {
  const spaceUrl = 'https://jabrave-deepfake-api.hf.space';
  const videoUrl = 'https://github.com/gradio-app/gradio/raw/main/gradio/media_assets/videos/world.mp4';

  console.log('Sending predict_video request...');
  const res = await fetch(`${spaceUrl}/gradio_api/call/predict_video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        path: videoUrl,
        meta: { _type: 'gradio.FileData' },
        orig_name: 'world.mp4',
        url: videoUrl
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
  const streamRes = await fetch(`${spaceUrl}/gradio_api/call/predict_video/${event_id}`);
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

testVideo().catch(console.error);
