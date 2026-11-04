# Capsule privacy policy (draft — have it reviewed before publishing)

**Hosted web app.** Your library is stored inside your own browser (no account, no server copy). The site's only server part is a stateless relay that forwards shopping-search, AI and web-page requests you trigger; it keeps and logs nothing, but the destination sites (and Cloudflare, as host) see those requests like any web traffic.

**Where your data lives.** Everything you add (clothes, photos, outfits, boards, measurements, preferences) is stored on the device or computer running Capsule, in a local database and image folder. There is no Capsule account and no Capsule server.

**What can leave your device.** Only when you turn on a feature that needs an outside service and add its key:
- Google Gemini or OpenAI (whichever key you add): the photos you choose to analyse or edit, shrunk first (pieces, outfit photos, inspiration looks, face and body photos, try-on and avatar photos), and a short text summary of your profile, closet and habits (the AI brain). Never your whole library.
- SerpApi (shopping search): your search text and country.
- Open-Meteo (weather): approximate location coordinates.
No model runs on your computer: reading faces and bodies, cut-outs, glasses and try-on are all done by the AI service you chose, for that one request, and the photo is not stored by Capsule (unless you keep it as your avatar).

**Your controls.** Optional PIN; encrypted backup; Delete everything wipes the database, photos, thumbnails and offline cache (and, if you choose, saved keys).

**Shopping links.** Capsule currently adds no affiliate tags and earns nothing from clicks. If that changes it will be disclosed next to each link.

**Not advice.** Style, colour and grooming suggestions are guidance, not judgement.

**Contact:** (add before publishing)

## Google Play data-safety draft
Data collected by the developer: none. Data shared: none by default; optional user-initiated transfers to the services above. Encrypted in transit: yes (HTTPS to those services). Deletion: in-app Delete everything. Camera/photos: used locally.
