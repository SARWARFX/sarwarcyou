async function testSearch(q) {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  
  // 1. Try DDG
  let results = [];
  try {
    const initRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    const html = await initRes.text();
    const vqdMatch = html.match(/vqd=([0-9-]+)/) || html.match(/vqd=['"]([0-9-]+)['"]/);
    if (vqdMatch && vqdMatch[1]) {
      const vqd = vqdMatch[1];
      const imgRes = await fetch(`https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,&p=1`, {
        headers: {
          'User-Agent': ua,
          'Referer': 'https://duckduckgo.com/',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      if (imgRes.ok) {
        const data = await imgRes.json();
        if (data.results && data.results.length > 0) {
          results = data.results.map((r, i) => ({
            id: `ddg_${i}`,
            title: r.title || q,
            image: r.image,
            thumbnail: r.thumbnail,
            sourceUrl: r.url
          }));
        }
      }
    }
  } catch (e) {
    console.warn('DDG failed:', e.message);
  }

  console.log('DDG count:', results.length);

  // 2. Fallback to Wikimedia Commons if DDG is empty
  if (results.length === 0) {
    try {
      const wmUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=35&prop=imageinfo&iiprop=url|size|mime&format=json&origin=*`;
      const wmRes = await fetch(wmUrl);
      if (wmRes.ok) {
        const d = await wmRes.json();
        const pages = d?.query?.pages ? Object.values(d.query.pages) : [];
        results = pages
          .filter((p) => p.imageinfo?.[0]?.url && !p.imageinfo[0].mime?.includes('svg'))
          .map((p, i) => ({
            id: `wm_${p.pageid || i}`,
            title: (p.title || q).replace(/^File:/i, '').replace(/\.[^/.]+$/, ''),
            image: p.imageinfo[0].url,
            thumbnail: p.imageinfo[0].thumburl || p.imageinfo[0].url,
            sourceUrl: p.imageinfo[0].descriptionurl || p.imageinfo[0].url
          }));
      }
    } catch (e) {
      console.warn('WM failed:', e.message);
    }
  }

  console.log('Final count:', results.length);
  if (results.length > 0) {
    console.log('Sample result:', results[0]);
  }
}

testSearch('tangia bd');
