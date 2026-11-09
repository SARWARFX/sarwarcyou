#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'src', 'data', 'celebrityGallery.json');

export const CELEBRITIES = [
  'Deepika Padukone',
  'Katrina Kaif',
  'Alia Bhatt',
  'Kiara Advani',
  'Shraddha Kapoor',
  'Kriti Sanon',
  'Disha Patani',
  'Kareena Kapoor',
  'Jacqueline Fernandez',
  'Anushka Sharma',
];

// Curated, strictly verified high-resolution portraits of the actual actresses
export const SEED_FALLBACK_GALLERY = [
  // --- Deepika Padukone ---
  {
    id: 'deepika-padukone-cannes-2019',
    name: 'Deepika Padukone',
    title: 'Deepika Padukone at 2019 Cannes Film Festival',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/1/13/Deepika_Padukone_at_2019_Cannes_%28cropped%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/1/13/Deepika_Padukone_at_2019_Cannes_%28cropped%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000000000,
  },
  {
    id: 'deepika-padukone-cannes-2018',
    name: 'Deepika Padukone',
    title: 'Deepika Padukone Cannes Gala Appearance',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Deepika_Padukone_Cannes_2018.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Deepika_Padukone_Cannes_2018.jpg',
    aspect: 'portrait',
    timestamp: 1715000001000,
  },
  {
    id: 'deepika-padukone-pro-pics',
    name: 'Deepika Padukone',
    title: 'Deepika Padukone High Fashion Studio Portrait',
    category: 'Photoshoot',
    src: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Deepika_Padukone_Pro_Pics.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Deepika_Padukone_Pro_Pics.jpg',
    aspect: 'portrait',
    timestamp: 1715000002000,
  },
  {
    id: 'deepika-padukone-chhapaak',
    name: 'Deepika Padukone',
    title: 'Deepika Padukone Chhapaak Premiere Showcase',
    category: 'Trending',
    src: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Deepika_Padukone_promoting_Chhapaak_2.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Deepika_Padukone_promoting_Chhapaak_2.jpg',
    aspect: 'portrait',
    timestamp: 1715000003000,
  },
  {
    id: 'deepika-padukone-filmfare-59',
    name: 'Deepika Padukone',
    title: 'Deepika Padukone 59th Filmfare Awards Red Carpet',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/3/35/Deepika_Padukone_at_the_59th_Idea_Filmfare_Awards_2013.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/3/35/Deepika_Padukone_at_the_59th_Idea_Filmfare_Awards_2013.jpg',
    aspect: 'portrait',
    timestamp: 1715000004000,
  },
  {
    id: 'deepika-padukone-kalki',
    name: 'Deepika Padukone',
    title: 'Deepika Padukone Kalki 2898 AD Pre-Release Event',
    category: 'Trending',
    src: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Deepika_Padukone_at_Kalki_2898_AD_pre_release_event_in_Mumbai_%282%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Deepika_Padukone_at_Kalki_2898_AD_pre_release_event_in_Mumbai_%282%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000005000,
  },

  // --- Katrina Kaif ---
  {
    id: 'katrina-kaif-iifa-2017',
    name: 'Katrina Kaif',
    title: 'Katrina Kaif IIFA Awards Red Carpet Glamour',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Katrina_Kaif_at_IIFA_2017_%28cropped%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Katrina_Kaif_at_IIFA_2017_%28cropped%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000006000,
  },
  {
    id: 'katrina-kaif-zeecine-2018',
    name: 'Katrina Kaif',
    title: 'Katrina Kaif Zee Cine Awards Red Carpet Stunner',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/4/41/Katrina_Kaif_graces_the_red_carpet_of_Zee_Cine_Awards_2018_%2808%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/4/41/Katrina_Kaif_graces_the_red_carpet_of_Zee_Cine_Awards_2018_%2808%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000007000,
  },
  {
    id: 'katrina-kaif-bharat-2019',
    name: 'Katrina Kaif',
    title: 'Katrina Kaif Bharat Promotional Portrait',
    category: 'Photoshoot',
    src: 'https://upload.wikimedia.org/wikipedia/commons/8/8b/Katrina_Kaif_promoting_Bharat_in_2019.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/8/8b/Katrina_Kaif_promoting_Bharat_in_2019.jpg',
    aspect: 'portrait',
    timestamp: 1715000008000,
  },
  {
    id: 'katrina-kaif-launch-party',
    name: 'Katrina Kaif',
    title: 'Katrina Kaif Launch Gala Chic',
    category: 'Trending',
    src: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Katrina_Kaif_at_Blackberry_curve%27s_launch_party_%282%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Katrina_Kaif_at_Blackberry_curve%27s_launch_party_%282%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000009000,
  },

  // --- Alia Bhatt ---
  {
    id: 'alia-bhatt-cannes-2026',
    name: 'Alia Bhatt',
    title: 'Alia Bhatt Cannes Film Festival Appearance',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Alia_Bhatt_attends_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Alia_Bhatt_attends_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000010000,
  },
  {
    id: 'alia-bhatt-filmfare-ott-2025',
    name: 'Alia Bhatt',
    title: 'Alia Bhatt Filmfare OTT Awards Red Carpet',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Alia_Bhatt_at_the_Filmfare_OTT_Awards_2025_%28Upscaled%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Alia_Bhatt_at_the_Filmfare_OTT_Awards_2025_%28Upscaled%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000011000,
  },
  {
    id: 'alia-bhatt-brahmastra-launch',
    name: 'Alia Bhatt',
    title: 'Alia Bhatt Brahmastra Motion Poster Launch',
    category: 'Trending',
    src: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Alia_Bhatt_at_Brahmastra_motion_poster_launch_%282%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Alia_Bhatt_at_Brahmastra_motion_poster_launch_%282%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000012000,
  },
  {
    id: 'alia-bhatt-iifa-2017',
    name: 'Alia Bhatt',
    title: 'Alia Bhatt IIFA Awards Red Carpet Spotlight',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Alia_Bhatt_at_the_IIFA_Awards_2017_%283%29_%28cropped%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Alia_Bhatt_at_the_IIFA_Awards_2017_%283%29_%28cropped%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000013000,
  },

  // --- Kiara Advani ---
  {
    id: 'kiara-advani-interview',
    name: 'Kiara Advani',
    title: 'Kiara Advani High Fashion Interview Portrait',
    category: 'Photoshoot',
    src: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Kiara_Advani_at_Vinaya_Vidheya_Rama_interview_%282%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Kiara_Advani_at_Vinaya_Vidheya_Rama_interview_%282%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000014000,
  },
  {
    id: 'kiara-advani-shershaah',
    name: 'Kiara Advani',
    title: 'Kiara Advani Shershaah Premiere Portrait',
    category: 'Trending',
    src: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Kiara_Advani_snapped_at_the_screening_of_Shershaah_%28cropped%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Kiara_Advani_snapped_at_the_screening_of_Shershaah_%28cropped%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000015000,
  },
  {
    id: 'kiara-advani-lfw-2023',
    name: 'Kiara Advani',
    title: 'Kiara Advani Lakme Fashion Week Runway Glamour',
    category: 'Photoshoot',
    src: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Kiara_Advani_at_the_ramp_of_Lakme_Fashion_Week_2023.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Kiara_Advani_at_the_ramp_of_Lakme_Fashion_Week_2023.jpg',
    aspect: 'portrait',
    timestamp: 1715000016000,
  },

  // --- Shraddha Kapoor ---
  {
    id: 'shraddha-kapoor-batti-gul',
    name: 'Shraddha Kapoor',
    title: 'Shraddha Kapoor Promotional Campaign Portrait',
    category: 'Trending',
    src: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Shraddha_Kapoor_Promote_Batti_Gul_Meter_Chalu.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Shraddha_Kapoor_Promote_Batti_Gul_Meter_Chalu.jpg',
    aspect: 'portrait',
    timestamp: 1715000017000,
  },
  {
    id: 'shraddha-kapoor-lfw-2014',
    name: 'Shraddha Kapoor',
    title: 'Shraddha Kapoor Lakme Fashion Week Showstopper',
    category: 'Photoshoot',
    src: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Shraddha_Kapoor_walks_for_Gitanjali_collection_at_Lakme_Fashion_Week_2014.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Shraddha_Kapoor_walks_for_Gitanjali_collection_at_Lakme_Fashion_Week_2014.jpg',
    aspect: 'portrait',
    timestamp: 1715000018000,
  },
  {
    id: 'shraddha-kapoor-rohit-bal',
    name: 'Shraddha Kapoor',
    title: 'Shraddha Kapoor Haute Couture Fashion Show',
    category: 'Photoshoot',
    src: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Shraddha_Kapoor_walks_for_Rohit_Bal_%26_Jabong%27s_fashion_show_%281%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Shraddha_Kapoor_walks_for_Rohit_Bal_%26_Jabong%27s_fashion_show_%281%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000019000,
  },

  // --- Kriti Sanon ---
  {
    id: 'kriti-sanon-iifa-2017',
    name: 'Kriti Sanon',
    title: 'Kriti Sanon IIFA Awards Red Carpet Glamour',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Kriti_Sanon_at_IIFA_2017.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Kriti_Sanon_at_IIFA_2017.jpg',
    aspect: 'portrait',
    timestamp: 1715000020000,
  },
  {
    id: 'kriti-sanon-adipurush-1',
    name: 'Kriti Sanon',
    title: 'Kriti Sanon Adipurush Royal Presentation',
    category: 'Trending',
    src: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Kriti_Sanon_at_Adipurush_pre_release_event_%281%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Kriti_Sanon_at_Adipurush_pre_release_event_%281%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000021000,
  },
  {
    id: 'kriti-sanon-adipurush-2',
    name: 'Kriti Sanon',
    title: 'Kriti Sanon Adipurush Pre-Release Gala Portrait',
    category: 'Trending',
    src: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Kriti_Sanon_at_Adipurush_pre_release_event_%282%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Kriti_Sanon_at_Adipurush_pre_release_event_%282%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000022000,
  },
  {
    id: 'kriti-sanon-heropanti',
    name: 'Kriti Sanon',
    title: 'Kriti Sanon Debut Promotional Portrait',
    category: 'Trending',
    src: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Kriti_Sanon_at_the_trailer_launch_of_%27Heropanti%27.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Kriti_Sanon_at_the_trailer_launch_of_%27Heropanti%27.jpg',
    aspect: 'portrait',
    timestamp: 1715000023000,
  },

  // --- Disha Patani ---
  {
    id: 'disha-patani-lfw-2017-02',
    name: 'Disha Patani',
    title: 'Disha Patani Lakme Fashion Week Showstopper',
    category: 'Photoshoot',
    src: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Disha_Patani_walk_the_ramp_at_Lakme_Fashion_Week_2017_%2802%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Disha_Patani_walk_the_ramp_at_Lakme_Fashion_Week_2017_%2802%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000024000,
  },
  {
    id: 'disha-patani-lfw-2017-day5',
    name: 'Disha Patani',
    title: 'Disha Patani Lakme Fashion Week Haute Couture',
    category: 'Photoshoot',
    src: 'https://upload.wikimedia.org/wikipedia/commons/7/76/Disha_Patani_on_Day_5_of_Lakme_Fashion_Week_2017.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/7/76/Disha_Patani_on_Day_5_of_Lakme_Fashion_Week_2017.jpg',
    aspect: 'portrait',
    timestamp: 1715000025000,
  },
  {
    id: 'disha-patani-gq-2016',
    name: 'Disha Patani',
    title: 'Disha Patani GQ Men of the Year Red Carpet',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Disha_Patani_graces_GQ_Men_of_The_Year_Awards_2016_%2833%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Disha_Patani_graces_GQ_Men_of_The_Year_Awards_2016_%2833%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000026000,
  },

  // --- Kareena Kapoor ---
  {
    id: 'kareena-kapoor-toifa-earrings',
    name: 'Kareena Kapoor',
    title: 'Kareena Kapoor TOIFA Awards High Jewelry Showcase',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/NIRAV_MODI_TOIFA_Awards_Kareena_Kapoor_Fluire_Earrings.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/b/be/NIRAV_MODI_TOIFA_Awards_Kareena_Kapoor_Fluire_Earrings.jpg',
    aspect: 'portrait',
    timestamp: 1715000027000,
  },
  {
    id: 'kareena-kapoor-lfw-2019',
    name: 'Kareena Kapoor',
    title: 'Kareena Kapoor Khan Lakme Fashion Week Royalty',
    category: 'Photoshoot',
    src: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Kareena_Kapoor_Khan_walks_the_ramp_at_Lakme_Fashion_Week_Summer_Resort_2019-Day-5-6.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Kareena_Kapoor_Khan_walks_the_ramp_at_Lakme_Fashion_Week_Summer_Resort_2019-Day-5-6.jpg',
    aspect: 'portrait',
    timestamp: 1715000028000,
  },
  {
    id: 'kareena-kapoor-filmfare',
    name: 'Kareena Kapoor',
    title: 'Kareena Kapoor Iconic Filmfare Red Carpet',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/2/25/Kareena_Kapoor_Filmfare.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/2/25/Kareena_Kapoor_Filmfare.jpg',
    aspect: 'portrait',
    timestamp: 1715000029000,
  },
  {
    id: 'kareena-kapoor-filmfare-glamour',
    name: 'Kareena Kapoor',
    title: 'Kareena Kapoor Khan Filmfare Glamour & Style Gala',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/2/26/Kareena_Kapoor_Khan_at_Filmfare_Glamour_%26_Style_Awards_2015.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/2/26/Kareena_Kapoor_Khan_at_Filmfare_Glamour_%26_Style_Awards_2015.jpg',
    aspect: 'portrait',
    timestamp: 1715000030000,
  },

  // --- Jacqueline Fernandez ---
  {
    id: 'jacqueline-fernandez-2025',
    name: 'Jacqueline Fernandez',
    title: 'Jacqueline Fernandez High Glamour Portrait',
    category: 'Photoshoot',
    src: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Jacqueline_Fernandez_in_2025.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Jacqueline_Fernandez_in_2025.jpg',
    aspect: 'portrait',
    timestamp: 1715000030500,
  },
  {
    id: 'jacqueline-fernandez-portrait',
    name: 'Jacqueline Fernandez',
    title: 'Jacqueline Fernandez Studio Elegance',
    category: 'Photoshoot',
    src: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Jacqueline_Fernandez.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Jacqueline_Fernandez.jpg',
    aspect: 'portrait',
    timestamp: 1715000030600,
  },
  {
    id: 'jacqueline-fernandez-sol',
    name: 'Jacqueline Fernandez',
    title: 'Jacqueline Fernandez SOL Launch Red Carpet',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Jacqueline_Fernandez_launch_of_SOL.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Jacqueline_Fernandez_launch_of_SOL.jpg',
    aspect: 'portrait',
    timestamp: 1715000030700,
  },

  // --- Anushka Sharma ---
  {
    id: 'anushka-sharma-sultan',
    name: 'Anushka Sharma',
    title: 'Anushka Sharma Sultan Premiere Showcase',
    category: 'Trending',
    src: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Anushka_Sharma_at_Sultan_Trailer_Launch.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Anushka_Sharma_at_Sultan_Trailer_Launch.jpg',
    aspect: 'portrait',
    timestamp: 1715000031000,
  },
  {
    id: 'anushka-sharma-mumbai-stylish',
    name: 'Anushka Sharma',
    title: 'Anushka Sharma Most Stylish Awards Red Carpet',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Anushka_Sharma_at_HT_Mumbai%E2%80%99s_Most_Stylish_Awards_2017_%2859%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Anushka_Sharma_at_HT_Mumbai%E2%80%99s_Most_Stylish_Awards_2017_%2859%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000032000,
  },
  {
    id: 'anushka-sharma-femina-beauty',
    name: 'Anushka Sharma',
    title: 'Anushka Sharma Femina Beauty Awards Gala',
    category: 'Red Carpet',
    src: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Anushka_Sharma%2C_6th-Nykaa_Femina_Beauty_Awards_2020_%281%29.jpg',
    thumb: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Anushka_Sharma%2C_6th-Nykaa_Femina_Beauty_Awards_2020_%281%29.jpg',
    aspect: 'portrait',
    timestamp: 1715000033000,
  },
];

/**
 * Clean Wikimedia file title into human-readable description
 */
function cleanTitle(rawTitle, celebName) {
  let cleaned = rawTitle
    .replace(/^File:/i, '')
    .replace(/\.(jpg|jpeg|png|webp)$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s*\(cropped\)/i, '')
    .replace(/\s*\(cropped \d+\)/i, '')
    .trim();

  return cleaned;
}

/**
 * Determine category tag based on image title
 */
function determineCategory(title) {
  const lower = title.toLowerCase();
  if (
    lower.includes('cannes') ||
    lower.includes('carpet') ||
    lower.includes('filmfare') ||
    lower.includes('iifa') ||
    lower.includes('awards') ||
    lower.includes('gala')
  ) {
    return 'Red Carpet';
  }
  if (
    lower.includes('photoshoot') ||
    lower.includes('fashion') ||
    lower.includes('editorial') ||
    lower.includes('vogue') ||
    lower.includes('elle') ||
    lower.includes('gq') ||
    lower.includes('magazine') ||
    lower.includes('ramp')
  ) {
    return 'Photoshoot';
  }
  return 'Trending';
}

/**
 * Fetch media items from Wikimedia Commons for a specific celebrity with strict filtering
 */
async function fetchCelebrityImages(celebrityName) {
  console.log(`[Sync] Querying Wikimedia Commons (strict intitle) for: ${celebrityName}...`);

  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `intitle:"${celebrityName}"`,
    gsrnamespace: '6',
    gsrlimit: '30',
    prop: 'imageinfo',
    iiprop: 'url|size',
    iiurlwidth: '640',
    format: 'json',
  });

  const apiUrl = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;

  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'SarwarVault/1.0 (contact@sarwar.cyou; BollywoodGallerySync)',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    console.warn(`[Sync] Failed query for ${celebrityName}: HTTP ${res.status}`);
    return [];
  }

  const data = await res.json();
  if (!data?.query?.pages) {
    return [];
  }

  const pages = Object.values(data.query.pages);
  const items = [];

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info || !info.url) continue;

    const width = info.width || 0;
    const height = info.height || 0;
    const rawTitle = page.title || '';
    const lowerTitle = rawTitle.toLowerCase();
    const celebLower = celebrityName.toLowerCase();

    // 1. Strict title match: must explicitly contain the exact celebrity name
    const isStrictMatch =
      lowerTitle.includes(celebLower) &&
      !lowerTitle.match(/crowd|audience|stadium|nominees|awards_ceremony_general/i);

    if (!isStrictMatch) continue;

    // 2. Exclude other people's names or multi-person / group / non-portrait subjects
    if (
      lowerTitle.match(
        /raai laxmi|sheetal agashe|akwaboah|morgan berry|munnycat|salman khan|ranbir kapoor|ranveer singh|shah|sharma with|\band\b|&|\bwith\b|\balongside\b|,|\bsisters\b|\bfamily\b|\bgroup\b|statue|tussauds|figure|wax|poster/i
      )
    ) {
      continue;
    }

    // 3. Require portrait aspect ratio (height > width) and height >= 850px
    if (height <= width || height < 850) {
      continue;
    }

    // Filter out vector or animation assets
    const rawUrl = info.url;
    if (rawUrl.toLowerCase().endsWith('.svg') || rawUrl.toLowerCase().endsWith('.gif')) {
      continue;
    }

    // Direct clean URLs without query parameters
    const cleanSrc = rawUrl.split('?')[0];
    const thumbUrl = (info.thumburl || rawUrl).split('?')[0];

    const slug = `${celebrityName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${page.pageid || Math.floor(Math.random() * 100000)}`;
    const displayTitle = cleanTitle(rawTitle, celebrityName);
    const category = determineCategory(displayTitle);

    items.push({
      id: slug,
      name: celebrityName,
      title: displayTitle,
      category,
      src: cleanSrc,
      thumb: thumbUrl,
      aspect: 'portrait',
      timestamp: Date.now(),
    });
  }

  return items;
}

async function main() {
  console.log('--- STARTING BOLLYWOOD CELEBRITY HD WALLPAPER SYNC ---');

  const collected = [];
  const seenUrls = new Set();
  const seenTitles = new Set();

  for (const celeb of CELEBRITIES) {
    try {
      const fetched = await fetchCelebrityImages(celeb);
      for (const item of fetched) {
        const titleKey = `${item.name}-${item.title}`.toLowerCase();
        if (!seenUrls.has(item.src) && !seenTitles.has(titleKey)) {
          seenUrls.add(item.src);
          seenTitles.add(titleKey);
          collected.push(item);
        }
      }
      // Gentle pacing to respect Wikimedia API rate limits
      await new Promise((resolve) => setTimeout(resolve, 350));
    } catch (err) {
      console.warn(`[Sync] Error fetching for ${celeb}:`, err.message);
    }
  }

  console.log(`[Sync] Live fetched entries: ${collected.length}`);

  // Merge with pre-verified high-resolution seed fallback items
  for (const seed of SEED_FALLBACK_GALLERY) {
    const titleKey = `${seed.name}-${seed.title}`.toLowerCase();
    if (!seenUrls.has(seed.src) && !seenTitles.has(titleKey)) {
      seenUrls.add(seed.src);
      seenTitles.add(titleKey);
      collected.push(seed);
    }
  }

  // Interleave and sort by celebrity for diverse showcase distribution
  const finalCatalog = collected.sort((a, b) => {
    if (a.name === b.name) return a.title.localeCompare(b.title);
    return a.name.localeCompare(b.name);
  });

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalCatalog, null, 2), 'utf8');

  console.log(`[Sync] Successfully saved ${finalCatalog.length} HD celebrity entries to ${OUTPUT_FILE}`);
  console.log('--- SYNC COMPLETE ---');
}

main().catch((err) => {
  console.error('[Sync Fatal Error]:', err);
  process.exit(1);
});
