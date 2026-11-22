# Noor on an LG TV (webOS)

**Untested.** `Noor.ipk` is built in LG's package format by the same packer couch-tv uses, which
has installed on a number of real LG TVs, and the package was read back and checked. But **Noor
itself has never been opened on an LG**. Say that to the person before they decide, expect that
something may need fixing, and please open an issue with the model, the webOS version and what
happened. The steps below are LG's standard way to add your own app.

Steps are marked **Person** (at the TV, with the remote) or **You** (the agent, or whoever is at
the computer).

## What to tell the person

> "There is an LG version of Noor, but nobody has tried it on a real LG yet, so you would be the
> first and something may not work. LG lets you add your own apps through its Developer Mode app.
> That needs a free LG developer account, which you make on LG's website, and a computer on the
> same Wi-Fi once. There is one catch that is LG's rule, not ours: LG removes apps added this way
> when Developer Mode's timer runs out (about forty days on recent TVs, as little as two days on
> older ones), unless you open the Developer Mode app on the TV and press Extend before then. If you would rather avoid that, a
> Google TV or Fire TV stick in a spare HDMI port runs Noor with no such timer."

## What is needed

- A computer (Mac, Windows or Linux) on the same network as the TV.
- A free **LG developer account**: the **Person** registers at https://webostv.developer.lge.com
  and signs in with it on the TV.
- `Noor.ipk` ([the newest release](https://github.com/DevMohammadSalameh/noor-tv/releases/latest/download/Noor.ipk)).
- Either LG's command line tools (needs Node.js): `npm install -g @webos-tools/cli`, or the desktop
  app **webOS Dev Manager** (https://github.com/webosbrew/dev-manager-desktop), which does steps 2
  and 3 with buttons.

## 1. Person: Developer Mode on the TV

1. Open the **LG Content Store** (or **Apps**), search for **Developer Mode** and install it.
2. Open it and sign in with the LG developer account.
3. Switch **Dev Mode Status** on. The TV restarts.
4. Open Developer Mode again and switch **Key Server** on. Read out the **passphrase** (six
   characters, capitals matter) and the TV's **IP address**, both shown on that screen.

LG's own page for this: https://webostv.developer.lge.com/develop/getting-started/developer-mode-app

**Done when** you have the address and the passphrase, and Key Server is on.

## 2. You: introduce the computer to the TV

```sh
ares-setup-device -a noor -i "username=prisoner" -i "host=<tv address>" -i "port=9922"
printf '<passphrase>\n' | ares-novacom --device noor --getkey
ares-setup-device -m noor -i "privatekey=noor_webos" -i "passphrase=<passphrase>"
```

The second line fetches the TV's key; it normally asks for the passphrase at a prompt, which an
agent cannot type into, hence the pipe. The third line stores the passphrase with the key, without
which the next step fails with "All configured authentication methods failed".

**Done when** `ares-launch --device noor com.palmdts.devmode` makes the Developer Mode app come up
on the TV.

On Windows the key file is `%USERPROFILE%\.ssh\noor_webos`. If `ares-install` then says
"Encrypted OpenSSH private key detected", the third line was skipped.

## 3. You: install

```sh
ares-install --device noor Noor.ipk
ares-launch --device noor io.github.devmohammadsalameh.noor
```

**Done when** `ares-install` prints `Success` and the **Person** sees Noor open on the TV and in
the TV's row of apps.

If the TV answers "ipk verified failed", say so in the issue: it means this TV wants the package
made differently, and that needs a fix here rather than a retry.

## 4. Person: keep it installed

In the Developer Mode app, **Remain Session** shows the hours left (couch-tv saw close to 1,000
hours on a recent TV; older ones give 50). Before it reaches zero, open Developer Mode and press
**Extend**. If it runs out, LG removes Noor; steps 1 and 3 put it back, and the settings inside
Noor may have to be chosen again.

## Opening it automatically

There is no setting for this that has been tried with Noor. The person opens Noor from the row of
apps; moving it to the front of the row (hold OK on it, then move) keeps it one press away.

## The remote

Arrows, OK and Back. LG's coloured buttons work where the remote has them; where it does not, in
the Quran player press **▲** from the top row of surahs for the same options on screen. The Magic
Remote's pointer can click rows and buttons.

## If something goes wrong

These are from [couch-tv's LG guide](https://github.com/Seagey/couch-tv/blob/main/docs/LG.md),
which has been through ten LG TVs with its own app; read it for anything not listed.

| What happens | What to do |
|---|---|
| `ares-install` cannot connect | The TV restarted and Key Server is off again: Person switches it on. Check the address has not changed. |
| "No matched device" | `ares-setup-device --list` should show `noor`. Run step 2 again in the same terminal you install from. |
| The app opens black or stuck | Report it with the model and webOS version (Settings, General, About This TV). `ares-inspect --device noor --app io.github.devmohammadsalameh.noor` opens a web inspector on the app, if you can read one. |
| Noor disappeared after some weeks | The Developer Mode session ran out (step 4). |

## Take it off

```sh
ares-install --device noor --remove io.github.devmohammadsalameh.noor
```

or on the TV: hold OK on Noor in the row of apps and choose delete. To leave Developer Mode:
open the Developer Mode app and switch Dev Mode Status off (the TV restarts and LG removes
anything installed through it). Nothing else on the TV was changed.

## Building it yourself

`python3 scripts/build-webos.py` makes `dist/Noor-<version>.ipk` with Python alone.
