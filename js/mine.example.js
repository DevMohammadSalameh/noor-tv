/* Noor — your own photos (optional). Copy this file to js/mine.js and list your photos in it.
   scripts/make-scene.py makes the files and prints the line to paste here. js/mine.js,
   img/bg/mine/ and img/thumb/mine/ are ignored by git, so your photos are never published.

     id       the file name without ".jpg": img/bg/mine/<id>.jpg (1920x1080) and img/thumb/mine/<id>.jpg (320x180)
     mood     when it shows with "Background order: by time of day": dawn, day, dusk or night
     name     [Arabic, English], shown in Settings, Backgrounds
     accent, hi, argb, panel   the colours of the panels over this photo (left out: Noor's gold)
     glass: 1 img/bg/mine/<id>-glass.jpg exists (the scenery clock's frosted fill)
     fg: 1    img/bg/mine/<id>-fg.webp exists (the scenery, sky cut away, drawn over the clock)
     clock    { top: 150, size: 400 } where the scenery clock sits, in pixels of 1080; x: "left"; dark: 1 */
window.NOOR_MINE = {
  backgrounds: [
    // { id: 'beach', mood: 'day', name: ['الشاطئ', 'The beach'], glass: 1 }
  ]
};
