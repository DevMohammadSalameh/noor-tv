# For the AI agent putting Noor on someone's TV

Noor is an Islamic home dashboard for TVs: prayer times, the Hijri date, a Quran player, a verse
of the day, over full-screen photos. It runs on the TV alone: once installed, no computer and no
server are needed again.

The person you are helping is assumed to be **non-technical**. You do the computer work. They do
only what needs hands: pressing buttons on the TV and signing in to their own accounts. Speak in
plain words, ask one or two things at a time, and wait for each answer.

Work through these six steps in order.

## 1. Find out which TV it is

Ask the brand, then confirm with what they see on screen. If unsure, ask them to open the TV's
Settings and read you the About page.

| The TV | Guide | Tried on |
|---|---|---|
| **Samsung** smart TV, 2017 or newer (Tizen) | [docs/SAMSUNG.md](docs/SAMSUNG.md) | A real 2025 Samsung (Tizen 9.0) |
| **Android TV or Google TV** (Sony, TCL, Hisense, Philips, Xiaomi, Chromecast with Google TV, Nvidia Shield, Onn) and **Amazon Fire TV** | [docs/ANDROID-TV.md](docs/ANDROID-TV.md) | An Android 15 emulator driven with remote keys. No real TV yet |
| **LG** smart TV (webOS) | [docs/LG.md](docs/LG.md) | Nothing. The package is built and its format checked; Noor has never run on an LG |
| Anything else (Roku, Apple TV, Vizio, Hisense VIDAA, Panasonic, older sets) | none | Not supported |

For a TV in the last row, say so kindly and stop: a Google TV or Fire TV stick in a spare HDMI
port (about US$30 to $50) makes any TV an Android one, and Noor goes on that.

**Done when** the person has confirmed the row their TV is in.

## 2. Say what will happen, and get a yes

Read the chosen guide's "What to tell the person" section to them in your own plain words: what
they need, what you will do, what they will do with the remote, the limits, and that it can all
be undone. For LG and Android TV, say how little it has been tried (the table above) before they
decide.

**Done when** they have clearly said yes. Until then, change nothing on the TV and install
nothing outside this folder. Looking things up, cloning this repository and downloading the Noor
package are fine.

## 3. Get the package

Download the newest release. These links never change:

| TV | File |
|---|---|
| Samsung | `https://github.com/DevMohammadSalameh/noor-tv/releases/latest/download/Noor.wgt` |
| Android TV, Google TV, Fire TV | `https://github.com/DevMohammadSalameh/noor-tv/releases/latest/download/Noor.apk` |
| LG | `https://github.com/DevMohammadSalameh/noor-tv/releases/latest/download/Noor.ipk` |

Build it yourself only if the download fails or the person wants their own photos in it
(README, "Your own photos"): `sh scripts/build.sh`, `sh scripts/build-android.sh`,
`python3 scripts/build-webos.py`. Each script's header says what it needs.

**Done when** the file is on the computer and is larger than 5 MB.

## 4. Install it

Follow the guide for their TV from top to bottom. Each guide marks who does each step: **Person**
(at the TV, with the remote) or **You** (on the computer).

When a step fails, stop, tell the person what happened in one sentence, and look in the guide's
"If something goes wrong" section. Report what you tried.

**Done when** the install command reports success and the person sees **Noor** among the TV's apps.

## 5. Check it together

With the person at the TV:

1. They open Noor. It asks three things the first time: language, city, look. Help them choose.
2. They compare today's prayer times with their mosque's timetable. If one differs by a few
   minutes, show them **Settings, Prayer, Fine-tune**.
3. They press OK on the **Quran** button, pick a surah and hear it play.

**Done when** all three worked, or you have told them exactly which one did not.

## 6. Hand over

Tell them, briefly: how Noor opens when the TV is switched on (each guide's "Opening it
automatically"), how to remove it (each guide's "Take it off"), and that a newer version is
installed the same way.

If the TV was an LG or an Android TV, ask them to open an issue at
https://github.com/DevMohammadSalameh/noor-tv/issues saying the model and how it went, and write
down for them what worked and what did not. Those reports are how those rows in the table get
filled in.

## Rules that hold throughout

- **Their accounts are theirs.** The Samsung sign-in, the LG developer account and any password
  are typed by the person, in their own browser or on the TV. You wait while they do it.
- **Leave the TV's own software as it is.** Noor is an app beside the TV's home screen. The only
  setting these guides change is the TV's Developer Mode (Samsung, LG) or its debugging and
  unknown-apps switches (Android), and each guide says how to switch them back.
- **One TV at a time.** Check the address belongs to the TV the person means before you install.
- **Their photos and settings stay private.** `js/mine.js` and the `mine` photo folders are
  ignored by git; keep them out of commits, issues and logs.
- **Say what you could not check.** You cannot see the TV. Ask the person what is on screen
  rather than assuming a step worked.

## Changing Noor itself

README.md ("Where things are", "Try it in a browser") is the map for code changes. The app is
plain ES5 HTML, CSS and JavaScript with no build step: `python3 -m http.server` and a browser run
it, and `?fresh=1`, `?look=`, `?open=` in the address reach its states.
