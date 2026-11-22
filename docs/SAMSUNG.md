# Noor on a Samsung TV

For Samsung smart TVs from 2017 on (Tizen). This is the path Noor was made for and the only one
run on a real TV so far: a 2025 Crystal UHD (U8000F, Tizen 9.0).

Steps are marked **Person** (at the TV, with the remote) or **You** (the agent, or whoever is at
the computer).

## What to tell the person

> "Noor goes on your Samsung as an app. Samsung only lets you add your own apps through something
> called Developer Mode, which is a switch in the TV's menus that I will walk you through. It needs
> a computer on the same Wi-Fi as the TV, once, for about ten minutes. You will sign in to your
> Samsung account once in a browser, so the app can be approved for your TV; I never see the
> password. After that the TV runs Noor by itself. Samsung's Home button still opens Samsung's own
> menu: Noor is an app, and it can be removed like any other."

## What is needed

- A computer (Mac, Windows or Linux) on the same Wi-Fi or network as the TV.
- A Samsung account. The one already on the TV is fine; a new free one works too.
- `Noor.wgt` ([the newest release](https://github.com/DevMohammadSalameh/noor-tv/releases/latest/download/Noor.wgt)).

## 1. Person: switch on Developer Mode

**You** first find the computer's address on the network, because the TV asks for it:
macOS `ipconfig getifaddr en0` (or `en1`), Linux `hostname -I`, Windows `ipconfig` (the IPv4 line).

Then the **Person**:

1. On the TV open **Apps**.
2. Press **1 2 3 4 5** on the remote. With the small remote that has no number buttons, press the
   **123** button and use the number pad that appears on screen.
3. A Developer Mode box opens. Switch it **On**, and type the computer's address in the Host PC
   IP boxes. Type each group as it is, with no zeros in front (a group of `7` is `7`, not `007`).
   Press OK.
4. **Restart the TV**: hold the power button until the Samsung logo appears. A short press only
   puts it to sleep, and Developer Mode does not start until a real restart.

**Done when** the TV has restarted. Step 3 checks that the switch took.

## 2. You: get the install tool

[Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung) signs an app with the person's own
Samsung certificate and installs it. Its command line needs no administrator password:

1. Open https://github.com/Apps2Samsung/Apps2Samsung/releases/latest and download the file named
   `Apps2Samsung.Cli-v<version>-<system>` for this computer: `osx-arm64` (Apple silicon Mac),
   `osx-x64` (Intel Mac), `linux-x64`, `linux-arm64`, `win-x64` or `win-arm64`.
2. Unpack it into `build/apps2samsung/` in this folder (git ignores `build/`).
3. Run `build/apps2samsung/apps2samsung-cli --help` (`apps2samsung-cli.exe` on Windows). On a Mac
   that refuses to open it, run `xattr -dr com.apple.quarantine build/apps2samsung` once.

A person without an agent can use the same project's desktop app instead (a `.dmg`, `.msi` or
`.AppImage` on that page): pick the TV, choose **Custom .wgt**, pick `Noor.wgt`, press Install.

## 3. You: find the TV and check it

```sh
build/apps2samsung/apps2samsung-cli scan
build/apps2samsung/apps2samsung-cli tv <tv address>
```

`scan` lists the Samsung TVs on the network. If it finds none, ask the **Person** for the TV's
address: Settings, General (or Connection), Network, Network Status, IP Settings.

**Done when** `tv` prints `ready`, `developer mode on`, and this computer's address as the host.

## 4. You and the Person: install

```sh
build/apps2samsung/apps2samsung-cli install Noor.wgt --tv <tv address>
```

The first time, a browser opens on the computer for the Samsung account. The **Person** signs in
there. The tool turns that sign-in into a certificate for this one TV and keeps it on the
computer, so later installs need no sign-in. The TV may ask to allow the connection: the
**Person** chooses Allow.

`Noor.wgt` is unsigned on purpose. A Samsung TV runs only apps signed for that TV, so a package
signed by anyone else would be refused; this step signs it for theirs.

**Done when** the command ends with `Installed Noor` and the **Person** sees **Noor** in Apps.

## Opening it automatically

**Person**, on the TV: **Settings, General, Smart Features, Autorun Last App**, on. When Noor was
the last app open before the TV was switched off, the TV starts on it. On newer models the same
switch is under **Settings, All Settings, General & Privacy, Start Screen Option**.

## If something goes wrong

Much of this list is from [couch-tv's Samsung guide](https://github.com/Seagey/couch-tv/blob/main/docs/SAMSUNG.md),
which has been through many more TVs.

| What happens | What to do |
|---|---|
| Pressing 1 2 3 4 5 on Apps does nothing (2022 and newer TVs) | On the Apps screen scroll to the bottom and open **App Settings**; the box opens from there. |
| `tv` says Developer Mode is off, or the host is another address | Open the box again (step 1), fix the address, and restart the TV by holding power. |
| "IP Mismatch" or "Connection reset by peer" | The address was typed with zeros in front, or the computer's address changed. Retype it in the box, restart the TV. |
| `tv` says the install service is not running, right after enabling | Unplug the TV for a full minute. If it persists: Settings, Support, Software Update, then unplug for a minute again. |
| No browser opens for the sign-in (a computer with no screen) | `apps2samsung-cli cert --prepare` prints a sign-in address to open elsewhere. |
| It worked for months, then Noor vanished | A TV software update can switch Developer Mode off and remove such apps. Do steps 1 and 4 again. |
| Install fails a year later with a certificate error | The certificate lasts a year. Install again with `--force-login` and sign in once more. |

## Take it off

```sh
build/apps2samsung/apps2samsung-cli uninstall NoorHome01 --tv <tv address>
```

or on the TV: Apps, Settings (the cog), pick Noor, Delete. To switch Developer Mode off again:
Apps, **1 2 3 4 5**, Off, restart the TV. Nothing else on the TV was changed.
