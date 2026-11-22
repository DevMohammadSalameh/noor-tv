# Noor on Android TV, Google TV and Fire TV

One app, `Noor.apk`, for TVs and boxes that run Android: Sony, TCL, Hisense (Android or Google TV
models), Philips, Xiaomi, Chromecast with Google TV, Google TV Streamer, Nvidia Shield, Onn, and
Amazon Fire TV sticks and TVs that run **Fire OS**. Android 5 or newer.

Not for Amazon's newest low-cost sticks that run **Vega OS** (Settings, My Fire TV, About says
which): they are not Android and cannot take this app.

**How far it has been tried.** The app was built and run in an Android 15 emulator, driven with
the same key presses a remote sends: the first-run setup, the home, a surah playing, the TV
keyboard for the city search, and Back leaving the app all worked. It has **not been run on a
real TV yet**, and Way B below (Downloader) has not been walked through on one either: its menu
names are the usual ones, not ones we have watched. Tell the person so, and afterwards please
open an issue with the model and how it went.

Steps are marked **Person** (at the TV, with the remote) or **You** (the agent, or whoever is at
the computer).

## What to tell the person

> "Noor goes on your TV as a normal app, like one from the app store, except we put it there
> ourselves because it is not in the store. Nothing about your TV's home screen changes, and you
> can delete it like any app. There are two ways. If you have a computer on the same Wi-Fi, I can
> send it across after you flip two switches in the TV's settings. With no computer, you install
> a free app called Downloader on the TV and type one web address. This version has been tested
> on a computer, not yet on a real TV, so you may be among the first."

## Which way

| | Way A: from a computer | Way B: on the TV alone |
|---|---|---|
| Needs | A computer on the same Wi-Fi | Only the TV and its remote |
| The person does | Switches on Developer options and debugging | Installs Downloader, allows it, types an address |
| Best when | An agent is helping | Nobody technical is around |

## Way A: from a computer

### A1. Person: switch on debugging

Menus differ between makers; these are the usual places.

**Google TV (most TVs from 2021 on, Chromecast):**
1. **Settings, System, About**. Scroll to **Android TV OS build** and press OK on it seven times,
   until it says "You are now a developer".
2. Back one step: **Settings, System, Developer options**. Switch **USB debugging** on. If there is
   also a **Network debugging** or **Wireless debugging** switch, switch that on too.
3. **Settings, Network & Internet**, press OK on the connected network, and read out the **IP address**.

**Older Android TV (version 9 to 11):** the same, under **Settings, Device Preferences, About**
(the line is **Build**) and **Settings, Device Preferences, Developer options**.

**Fire TV:** **Settings, My Fire TV, About**, press OK on the device's name seven times; then
**Settings, My Fire TV, Developer Options, ADB Debugging**, on. The address is under
**Settings, My Fire TV, About, Network**.

### A2. You: get adb

`adb` is Google's tool for talking to an Android device. If `adb version` does not already work,
download Google's platform-tools (a zip, no administrator password) and unpack it into
`build/platform-tools/`:
`https://dl.google.com/android/repository/platform-tools-latest-darwin.zip`, `-linux.zip` or
`-windows.zip`.

On a Mac, the first use may ask to "find devices on your local network": the person chooses
Allow. If `adb` then times out, switch it on by hand under System Settings, Privacy & Security,
Local Network.

### A3. You and the Person: connect and install

```sh
adb connect <tv address>:5555
```

The TV shows **"Allow USB debugging?"**. The **Person** ticks **Always allow from this computer**
and chooses Allow. Then:

```sh
adb devices                      # the TV's address, followed by "device"
adb -s <tv address>:5555 install -r Noor.apk
adb -s <tv address>:5555 shell am start -n io.github.devmohammadsalameh.noor/.MainActivity
```

**Done when** `install` prints `Success` and Noor is on the TV's screen.

**Only "Wireless debugging", and `adb connect` is refused?** On the TV open Wireless debugging and
choose **Pair device with pairing code**. It shows an address with a port, and a six-digit code.
Run `adb pair <tv address>:<pairing port> <code>`, then `adb connect <tv address>:<port>` using
the port shown under "IP address and port" on the Wireless debugging screen (it is not 5555).

### A4. Person: switch debugging off again

It is only needed for the install. In Developer options switch USB debugging (and Network or
Wireless debugging) off.

## Way B: on the TV alone

1. **Person:** open the TV's app store (Google Play on the TV, or the Appstore on a Fire TV),
   search for **Downloader** (by AFTVnews, orange icon) and install it.
2. **Person:** let Downloader install apps. If you skip this, Android asks at step 4 instead and
   offers a **Settings** button that leads to the same switch.
   - Google TV: **Settings, Apps, Security & restrictions, Unknown sources**, switch **Downloader** on.
     On some versions it is **Settings, Privacy, Security & restrictions**.
   - Older Android TV: **Settings, Device Preferences, Security & restrictions, Unknown sources**.
   - Fire TV: **Settings, My Fire TV, Developer Options, Install unknown apps**, switch
     **Downloader** on. (If Developer Options is missing: Settings, My Fire TV, About, press OK on
     the device's name seven times.)
3. **Person:** open Downloader. The first time it asks to access files: choose Allow. Choose the
   address box, and type exactly:

   ```
   github.com/DevMohammadSalameh/noor-tv/releases/latest/download/Noor.apk
   ```

   Capital letters matter. Press **Go**. If it does not start, type `https://` in front.
   Typing this with a remote is slow. The phone app for the TV has a keyboard: **Google TV** (or
   Google Home) for a Google TV, the **Amazon Fire TV** app for a Fire TV. With the address box
   open on the TV, typing on the phone fills it in.
4. **Person:** when the download ends choose **Install**, then **Open**. If a Google Play Protect
   box says the app is from an unknown developer, choose **Install anyway**. Afterwards Downloader
   offers to delete the downloaded file: choose Delete.
5. **Person:** switch the Unknown sources switch from step 2 off again. Downloader itself can stay
   or be uninstalled; Noor does not need it.

## Finding and opening Noor afterwards

It is in the TV's list of apps: on Google TV under **Apps, Your apps** (hold OK on it to add it to
the favourites row on the home); on Fire TV under **Your Apps & Channels** (press the menu button
on it and choose **Move to front**).

## Opening it automatically

An Android TV usually goes to sleep when switched off, rather than shutting down. If Noor was on
screen, it is on screen again when the TV wakes. After a full restart (a power cut), open it from
the apps list once. Noor keeps the TV from starting its screensaver while it is showing; **Settings,
Screen, Keep the TV awake** inside Noor turns that off.

## The remote

Arrows, OK and Back do everything. Play/pause, rewind and fast-forward work in the Quran player
on remotes that have them. Most of these remotes have no coloured buttons: in the Quran player
press **▲** from the top row of surahs to reach the same four options (favourite, favourites only,
reciter, what happens after a surah) on screen.

## If something goes wrong

| What happens | What to do |
|---|---|
| `adb connect` says "Connection refused" | Debugging is off, or the TV has only Wireless debugging (see the pairing note in A3). Some TVs need a restart after switching debugging on. |
| `adb devices` says "unauthorized" | The "Allow USB debugging?" box was missed. Have the person look at the TV; `adb disconnect`, then connect again to show it once more. |
| `install` says `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | A Noor built on someone's own computer is on the TV, signed with a different key. Remove it (below), then install. |
| Downloader shows an error instead of downloading | A letter is wrong or the wrong case: compare with the address above, character by character. Then try with `https://` in front. |
| Downloader says the app cannot be installed | Step 2 of Way B was skipped, or it was switched on for a different app. |
| "App not installed" straight after Install | An older Android than 5, or a Noor from another source is already there: uninstall it first. |
| The picture is the wrong size or cut off | Please open an issue with the TV model and the line `adb logcat -d \| grep "Noor "` prints: it holds the window size Noor measured. |
| No sound | Check another app has sound; then report it. Sound was not testable in the emulator. |

## Take it off

On the TV: **Settings, Apps, Noor, Uninstall**. Or `adb uninstall io.github.devmohammadsalameh.noor`.
Nothing else on the TV was changed, apart from the switches named above.

## Building it yourself

`sh scripts/build-android.sh` makes `dist/Noor-<version>.apk` with only a JDK and the Android SDK
(no Gradle, no Android Studio). Its header lists what it looks for. Neither needs an administrator
password:

- **JDK:** download the Temurin 21 `.tar.gz` from
  `https://api.adoptium.net/v3/binary/latest/21/ga/<mac or linux or windows>/<aarch64 or x64>/jdk/hotspot/normal/eclipse`
  and unpack it into `build/jdk`.
- **Android SDK:** unpack Google's "command line tools only" zip
  (https://developer.android.com/studio#command-line-tools-only) into
  `build/android-sdk/cmdline-tools/latest`, then
  `build/android-sdk/cmdline-tools/latest/bin/sdkmanager "platforms;android-34" "build-tools;34.0.0"`.

A build of your own is signed with a throwaway key unless you give it one (the script's header),
so it cannot be updated by the published release, or the other way round: uninstall first when
switching between them.
