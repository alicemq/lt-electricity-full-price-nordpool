# Android home screen widget spike (#23)

**Decision (2026-06):** Standard PWA cannot expose Android App Widgets. Interim UX: manifest shortcuts. Full widget requires TWA + native Kotlin.

## Platform matrix

| Approach | Android widget | Cost | Notes |
| --- | --- | --- | --- |
| PWA / WebAPK (Chrome install) | No | Low | No widget API for installed PWAs ([Chromium #1170639](https://bugs.chromium.org/p/chromium/issues/detail?id=1170639)) |
| Manifest shortcuts | No (launcher shortcuts only) | Low | Deep-link to `/today`, `/upcoming` |
| TWA (Bubblewrap / PWA Builder) | Yes, with native code | Medium | Wrap PWA in Play Store APK; `AppWidgetProvider` still required |
| Edge PWA Widgets (Windows 11) | N/A on Android | — | Experimental; not available on Android |

## Proposed phases

1. **Phase A (web-native):** Manifest `shortcuts` to `/today` and `/upcoming` (flows `manifest.webmanifest.example` pattern)
2. **Phase B (Android widget):** Separate minimal Android app (TWA shell + `AppWidgetProvider`) fetching `/api/v1/nps/prices/today` summary; Digital Asset Links with web origin
3. **Phase C (optional):** iOS widget via WidgetKit (separate native target)

## Widget refresh policy

Align polling with release-window phases (#17, #8): avoid aggressive refresh outside Nord Pool publication windows.

## Relevant paths

- `electricity-prices-build/public/site.webmanifest`
- flows reference: `vendor/flows/components/pwa/manifest.webmanifest.example`
- Future Phase B: new `android/` TWA project (out of scope for web-only revamp)

## References

- [web.dev WebAPKs](https://web.dev/articles/webapks)
- [MSEdgeExplainers PWAWidgets](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/PWAWidgets/README.md)
