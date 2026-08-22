# Scroll Brightness

A GNOME Shell extension that adds a panel indicator you can scroll over to
adjust screen backlight brightness — the same way scrolling over the volume
icon adjusts volume.

## How it works

- Adds a `display-brightness-symbolic` icon to the top-bar status area.
- Scrolling up/down over it steps brightness by 5% (mouse wheel and
  smooth/touchpad scroll both supported).
- Reads the current brightness from `/sys/class/backlight/<device>/brightness`
  and writes new values via `logind`'s
  `org.freedesktop.login1.Session.SetBrightness`, the same privileged
  mechanism GNOME's own Quick Settings brightness slider uses. No extra
  permissions, udev rules, or setuid helpers required.
- The backlight device is auto-detected (first entry under
  `/sys/class/backlight`), so it works regardless of whether your kernel
  exposes it as `intel_backlight`, `amdgpu_bl1`, etc.

## Installation

Not published on extensions.gnome.org — install manually:

```sh
git clone https://github.com/bramgn/gnome-scroll-brightness.git
mkdir -p ~/.local/share/gnome-shell/extensions/scroll-brightness@bramgn.github.io
cp gnome-scroll-brightness/{metadata.json,extension.js} \
   ~/.local/share/gnome-shell/extensions/scroll-brightness@bramgn.github.io/
```

Log out and back in (GNOME Shell only picks up new/changed extension code on
restart), then:

```sh
gnome-extensions enable scroll-brightness@bramgn.github.io
```

## Notes

- Only tested with a single internal panel backlight. If you have multiple
  backlight devices under `/sys/class/backlight`, the first one found (by
  directory enumeration order) is used.
- Step size is 5%; change the `STEP_PERCENT` constant in `extension.js` to
  taste.

## License

GPL-2.0-or-later — see [LICENSE](LICENSE).
