async function test() {
  const q = 'tangia bd';
  // Wikimedia
  const wmUrl = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(q) + '&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|size|mime&format=json&origin=*';
  const r1 = await fetch(wmUrl);
  const d1 = await r1.json();
  const pages = d1?.query?.pages ? Object.values(d1.query.pages) : [];
  console.log('Wikimedia count for tangia bd:', pages.length);

  // Flickr
  const tags = encodeURIComponent(q.replace(/\s+/g, ','));
  const flickrUrl = 'https://api.flickr.com/services/feeds/photos_public.gne?tags=' + tags + '&format=json&nojsoncallback=1';
  const r2 = await fetch(flickrUrl);
  const d2 = await r2.json();
  console.log('Flickr count for tangia bd:', d2.items ? d2.items.length : 0);
}
test();
