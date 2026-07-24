# ATOMIK Brand & UI Guide

Use this document to recreate the ATOMIK look and feel in another app. Values below match the live React Native / Expo service app (`frontend/`).

---

## 1. Brand identity

| Item | Value |
|------|--------|
| **Product name (UI)** | **ATOMIK** (all caps in logos, headers, bootstrap) |
| **Product name (sentence case)** | Atomik |
| **Full app name** | ATOMIK Audio |
| **Tagline** | Audio Engineering and Design · Service Infrastructure |
| **Splash tagline lines** | `AUDIO ENGINEERING AND DESIGN` / `SERVICE INFRASTRUCTURE` |
| **Legal entity** | Karma Electric (doing business as Atomik) |
| **Website** | [atomikaudio.com](https://atomikaudio.com) |
| **Contact** | contact@atomikaudio.com |
| **Package / scheme** | `com.atomikaudio.service` · `atomikaudio` |

**Spelling:** Always **Atomik / ATOMIK**. Never “Atmoik.”

### Voice & tone

- Industrial, precise, premium — audio / engineering infrastructure, not consumer lifestyle fluff
- Short labels, often **UPPERCASE** with letter-spacing
- Prefer clarity over decoration; red is reserved for action and emphasis

---

## 2. Visual direction

| Principle | Rule |
|-----------|------|
| **Mode** | **Dark only** — no light theme |
| **Canvas** | Near-black warm charcoal (`#231f20`), not pure black for main screens |
| **Accent** | Deep brick red (`#8e302f`) — CTAs, active tabs, focus rings, alerts |
| **Success** | Ash gray (`#b2beb5`) — **not** green |
| **Texture** | Subtle white borders at low opacity; glass / elevated surfaces |
| **Corners** | Soft but restrained (mostly 6–14px); industrial cards may use 4px |
| **Icons** | Ionicons; outline at rest, filled when active |

`userInterfaceStyle: 'dark'` · StatusBar: light content.

---

## 3. Color system

Canonical source: `frontend/src/constants/colors.ts`

### Core palette

| Token | Hex / RGBA | Use |
|-------|------------|-----|
| `background` | `#231f20` | App canvas, splash adaptive bg, StatusBar |
| `surface` | `#2b2728` | Cards, inputs, tab bar |
| `surfaceElevated` | `#332e2f` | Raised cards / sheets |
| `red` | `#8e302f` | Primary accent, CTAs, active tab, tints |
| `redDark` | `#6e2524` | Destructive confirm |
| `redMuted` | `rgba(142, 48, 47, 0.15)` | Soft red wash / icon circles |
| `white` | `#ffffff` | Primary text, filled splash CTA |
| `gray` | `#a09f9f` | Secondary text |
| `grayDark` | `#6b6869` | Muted text, inactive tabs, placeholders |
| `grayLight` | `#c8c7c7` | Tertiary / modal secondary labels |
| `border` | `rgba(255, 255, 255, 0.08)` | Default borders |
| `borderActive` | `rgba(142, 48, 47, 0.5)` | Focus / active borders |
| `ashGray` | `#b2beb5` | Success, confirmed, completed |
| `ashGrayBg` | `rgba(178, 190, 181, 0.15)` | Success chip background |
| `ashGrayBorder` | `rgba(178, 190, 181, 0.3)` | Success chip border |
| `overlay` | `rgba(35, 31, 32, 0.92)` | Scrim matching canvas |
| `glass` | `rgba(43, 39, 40, 0.6)` | Translucent panels |

### Timeline

| Token | Value |
|-------|--------|
| Active | `#8e302f` |
| Inactive | `#4a4547` |
| Pending | `#2b2728` |

### Status colors

| Status | Core | Background | Badge text | Badge border |
|--------|------|------------|------------|--------------|
| Confirmed / Completed | `#b2beb5` | `rgba(178, 190, 181, 0.15)` | `#b2beb5` | `rgba(178, 190, 181, 0.3)` |
| Pending | `#b8860b` | `rgba(184, 134, 11, 0.15)` | `#d4a017` | `rgba(212, 160, 23, 0.3)` |
| Ongoing | `#1a6b9e` | `rgba(26, 107, 158, 0.15)` | `#4a9edd` | `rgba(74, 158, 221, 0.3)` |
| New | `#8e302f` | `rgba(142, 48, 47, 0.15)` | `#8e302f` | `rgba(142, 48, 47, 0.3)` |
| Due | `#8e302f` | `rgba(142, 48, 47, 0.1)` | `#8e302f` | `rgba(142, 48, 47, 0.25)` |

**Warning accent (ad hoc):** `#e6b800` for alert icons.

### Common opacity recipes

| Value | Use |
|-------|-----|
| `rgba(255,255,255,0.03–0.12)` | Hairline borders, subtle surfaces, grids |
| `rgba(255,255,255,0.32)` | Outline CTA border (splash) |
| `rgba(255,255,255,0.55)` | Splash tagline |
| `rgba(142, 48, 47, 0.08 / 0.2 / 0.55)` | Rings, glow, input focus |
| `rgba(0,0,0,0.72)` | Modal overlay |
| `rgba(43, 39, 40, 0.7)` | Glass card fill |

### Gradients

| Surface | Stops | Positions |
|---------|-------|-----------|
| Splash | `#000000` → `#050404` → `#0a0808` → `#231f20` | `0 · 0.4 · 0.75 · 1` |
| Portal shell | `#080707` → `#231f20` → `#1c1819` | — |
| Horizon glow | White radial | opacity `0.55 → 0.12 → 0` |

### Do / don’t

- **Do** use ash gray for success — never default green.
- **Do** keep red for primary action and “attention,” not for large fills behind body copy.
- **Don’t** introduce purple gradients, neon glow, or cream/light themes.
- **Don’t** use pure `#000000` as the main screen background (splash gradient may start there).

---

## 4. Typography

Canonical source: `frontend/src/constants/typography.ts`  
Loaded via `@expo-google-fonts/montserrat` and `@expo-google-fonts/space-mono`.

### Font families

| Role | Family | Faces used |
|------|--------|------------|
| **Primary UI** | **Montserrat** | Light 300, Regular 400, Medium 500, SemiBold 600, Bold 700 |
| **Mono / technical** | **Space Mono** | Regular 400 only (also used where “bold mono” is needed) |

Expo font keys:

- `Montserrat_300Light`
- `Montserrat_400Regular`
- `Montserrat_500Medium`
- `Montserrat_600SemiBold`
- `Montserrat_700Bold`
- `SpaceMono_400Regular`

### Size scale

| Token | px |
|-------|-----|
| xs | 10 |
| sm | 12 |
| base | 14 |
| md | 16 |
| lg | 18 |
| xl | 20 |
| 2xl | 24 |
| 3xl | 28 |
| 4xl | 32 |
| 5xl | 40 |

### Line heights

| Multiplier | Value |
|------------|-------|
| tight | 1.2 |
| normal | 1.5 |
| relaxed | 1.75 |

Absolute helpers: xs 16 · sm 20 · base 22 · md 26 · lg 28 · body 24 · hint 20.

### Type recipes (copy these)

| Element | Family | Size | Weight | Letter-spacing | Notes |
|---------|--------|------|--------|----------------|-------|
| Button label | Montserrat | 13 | SemiBold | 1.5 | — |
| Header title | Montserrat | 14 | SemiBold | 2 | UPPERCASE |
| Input label | Montserrat | 11 | Medium | 1 | UPPERCASE |
| Input value | Montserrat | 14 | Regular | — | — |
| Input error | Space Mono | 11 | Regular | — | — |
| Badge | Space Mono | 9 | Regular | 1 | UPPERCASE |
| Tab label | Montserrat | 10 | Regular | — | — |
| Splash tagline | Montserrat | 10 | Light | 3.5 | UPPERCASE |
| Splash CTA | Montserrat | 13 | SemiBold | 3 | UPPERCASE |
| Onboarding title | Montserrat | 30 | Bold | — | lineHeight 38 |
| Portal section label | Space Mono | 8–11 | Regular | 2–3 | UPPERCASE |
| Brand wordmark fallback | System / Bold | 22 | 700 | 6 | `ATOMIK` while fonts load |

### Typography rules

1. **Montserrat** for human-readable UI (titles, body, buttons).
2. **Space Mono** for status chips, errors, technical section labels, portal meta.
3. Prefer **tracked uppercase** for chrome (headers, labels, badges) — not for long paragraphs.
4. Body copy stays sentence case, Regular/Medium, gray or white depending on hierarchy.

---

## 5. Spacing, radius, shadow

Canonical source: `frontend/src/constants/theme.ts` + `frontend/src/utils/layout.ts`

### Spacing scale

| Token | px |
|-------|-----|
| xs | 4 |
| sm | 8 |
| md | 12 |
| base | 16 |
| lg | 20 |
| xl | 24 |
| 2xl | 32 |
| 3xl | 40 |
| 4xl | 48 |
| 5xl | 64 |

### Screen layout

| Token | px | Use |
|-------|-----|-----|
| `screenH` | 20 | Default horizontal padding |
| `screenHWide` | 24 | Wider screens / roomier rows |
| `scrollBottom` | 32 | Scroll content bottom pad |
| `scrollBottomExtra` | 48 | Fullscreen / extra clearance |
| `headerBottom` | 14 | Space under header |
| Tab bar content height | 56 | Icons + labels (add safe-area inset) |

**Responsive scaling (`scaleSize`):** ×0.92 if width &lt; 360; ×1.15 if width ≥ 768; else 1.0.

### Border radius

| Token | px | Typical use |
|-------|-----|-------------|
| sm | 6 | Badges |
| md | 10 | Buttons, inputs |
| lg | 14 | Cards |
| xl | 18 | Larger panels |
| 2xl | 24 | Soft large containers |
| full | 9999 | Pills / circles |

Also used: modals **12**, industrial portal cards **4**, onboarding CTA circle **26**.

### Shadows

| Token | Color | Offset | Opacity | Radius | Elevation |
|-------|-------|--------|---------|--------|-----------|
| `sm` | `#000` | 0, 1 | 0.3 | 3 | 3 |
| `md` | `#000` | 0, 4 | 0.4 | 8 | 6 |
| `red` | `#8e302f` | 0, 0 | 0.3 | 12 | 8 |

Use shadows sparingly on dark UI; prefer borders and surface elevation first.

---

## 6. Safe area & chrome

- Library: `react-native-safe-area-context`
- Default screen edges: left + right; top handled by Header / ScreenTopBar
- Header / top bar: `paddingTop = insets.top + 8`
- Tab bar height: `56 + max(bottomInset, Android 10 / iOS 4)`
- Scroll bottom: `max(insets.bottom, 12) + 32` (or +48 when extra space needed)
- Keyboard: iOS `padding`, Android `height`

---

## 7. Component patterns

### Buttons

| Variant | Background | Border | Text |
|---------|------------|--------|------|
| **Primary** | `#8e302f` | — | White |
| **Secondary** | `#2b2728` | `rgba(255,255,255,0.12)` | White |
| **Outline** | Transparent | Red | Red |
| **Outline verified** | Fills to ash gray | Ash | White + check |
| **Ghost** | Transparent | — | Gray |

**Specs:** height **52** · radius **10** · horizontal padding **24** · disabled opacity **0.45** · press scale **~0.97**.

Splash CTAs: height **56**, white fill or outline, letter-spacing **3**.

### Cards

| Variant | Background | Border |
|---------|------------|--------|
| Default | `#2b2728` | `rgba(255,255,255,0.06)` |
| Elevated | `#332e2f` | `rgba(255,255,255,0.1)` + md shadow |
| Glass | `rgba(43,39,40,0.7)` | `rgba(255,255,255,0.1)` |

Default padding **16**, radius **14**.

### Inputs

- Container: surface bg, 1px border, radius **10**, minHeight **50**
- Focus border: `rgba(142, 48, 47, 0.55)`
- Error border: red
- Focus: slight lift (−1px spring)
- Selection color: red
- Leading/trailing icons: Ionicons **18**

### Badges

- Padding: 10 × 4 · radius **6** · 1px border
- Text: Space Mono 9 / letter-spacing 1 / UPPERCASE

### Tab bar

- Active: `#8e302f` · Inactive: `#6b6869`
- Background: surface · top border `rgba(255,255,255,0.06)`
- Labels: Montserrat Regular 10
- Icons: Ionicons filled/outline pairs (home, calendar, card, person)

### Headers

| Pattern | Notes |
|---------|--------|
| Standard Header | Background canvas; bottom border `rgba(255,255,255,0.05)`; optional logo; UPPERCASE title; Ionicons **22** |
| Dashboard top bar | Centered hero logo ~63× (aspect ~4.2); notification bell **28** |
| Screen top bar | Safe-area row; minHeight 52; paddingBottom 12 |
| Booking flow | Back chevron **24** |

Stack headers usually hidden; custom chrome preferred.

### Modals (confirm)

- Overlay: `rgba(0,0,0,0.72)`
- Card: surface, radius **12**, maxWidth **340**
- Icon circle: diameter **68**, `redMuted` fill / `borderActive`
- Primary action: height **48**, radius **8**

### Icons

| Context | Size |
|---------|------|
| Inline / form | 14–18 |
| Nav / chrome | 20–24 |
| Dashboard bell | 28 |
| Empty / modal | 36–48 |
| Warnings | ~40 |
| Onboarding custom SVG | default 56, white stroke |

Library: **`@expo/vector-icons` → Ionicons**.

---

## 8. Logo & assets

Files live in `frontend/assets/`.

| Asset | Role |
|-------|------|
| `atomik-logo-hero.png` | Primary mark (large / splash / dashboard) |
| `atomik-logo-transparent.png` | Small / medium mark |
| `atomik-logo-horizontal.png` | Horizontal lockup (asset available) |
| `atomik-logo-vertical.png` | Vertical lockup (asset available) |
| `atomik-logo-white.png` | White variant |
| `icon.png` | App / notification icon |
| `adaptive-icon.png` | Android adaptive FG on `#231f20` |
| `splash.png` | Native splash on `#231f20` |
| `favicon.png` | Web |
| `google-play-feature-graphic-atomik.png` | Store feature graphic |

### Logo sizes (component)

| Size | Height (approx) |
|------|-----------------|
| sm | 26 |
| md | 37 |
| lg | 50 |
| hero | 60 |
| xl | 73 |

Accessibility label: `"ATOMIK"`.

**Clear space:** Keep empty margin around the mark roughly equal to the height of the “A” counter; never place on busy photography without a dark scrim.

---

## 9. Motion

Canonical source: `frontend/src/utils/motion.ts`

| Token | Value |
|-------|--------|
| Ease out | cubic-bezier `(0.22, 1, 0.36, 1)` — premium / “Tesla–Linear” feel |
| Ease in-out | cubic-bezier `(0.45, 0, 0.15, 1)` |
| Fast | 220 ms |
| Normal | 420 ms |
| Slow | 680 ms |
| Stagger | `index × 70` ms |

### Patterns to reuse

- Pressables scale to **0.96–0.97** on press (spring)
- List / section **FadeIn**: opacity + translateY from ~22, staggered
- Splash: delayed logo → tagline → CTAs
- Input focus: border timing + lift spring
- Ambient: subtle pulse / drift on decorative backgrounds
- Navigation: slide ~300 ms · fade-from-bottom ~340 ms · fade ~380 ms

Motion should feel **present but calm** — not playful bounce or constant shimmer.

---

## 10. UX conventions

1. **One primary action** per screen — red filled button.
2. **Secondary** actions use outline / secondary / ghost; don’t compete with primary red.
3. **Status** always via ash / amber / blue badges — never invent a new green success color.
4. **Forms:** uppercase micro-labels, surface inputs, red focus, Space Mono errors under the field.
5. **Empty states:** large muted icon + short gray message + optional primary CTA.
6. **Destructive:** confirm in a modal; use `redDark` for the confirm action when irreversible.
7. **Navigation:** custom dark chrome; tab labels stay small (10px); active state is color + filled icon.
8. **Copy:** technical, short, infrastructure-flavored; avoid emoji in product chrome.
9. **Density:** industrial but breathable — default horizontal inset 20; cards with 16 padding.
10. **Accessibility:** light StatusBar on dark canvas; maintain contrast of white / gray on `#231f20`; don’t rely on red alone for status (pair with label).

---

## 11. CSS / design-token cheat sheet

Paste into web or design tools:

```css
:root {
  /* Brand */
  --atomik-bg: #231f20;
  --atomik-surface: #2b2728;
  --atomik-surface-elevated: #332e2f;
  --atomik-red: #8e302f;
  --atomik-red-dark: #6e2524;
  --atomik-red-muted: rgba(142, 48, 47, 0.15);
  --atomik-white: #ffffff;
  --atomik-gray: #a09f9f;
  --atomik-gray-dark: #6b6869;
  --atomik-gray-light: #c8c7c7;
  --atomik-border: rgba(255, 255, 255, 0.08);
  --atomik-border-active: rgba(142, 48, 47, 0.5);
  --atomik-ash: #b2beb5;
  --atomik-ash-bg: rgba(178, 190, 181, 0.15);
  --atomik-ash-border: rgba(178, 190, 181, 0.3);
  --atomik-pending: #b8860b;
  --atomik-ongoing: #1a6b9e;
  --atomik-overlay: rgba(35, 31, 32, 0.92);
  --atomik-glass: rgba(43, 39, 40, 0.6);

  /* Type */
  --font-sans: "Montserrat", sans-serif;
  --font-mono: "Space Mono", monospace;

  /* Space */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-base: 16px;
  --space-lg: 20px;
  --space-xl: 24px;
  --space-2xl: 32px;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;

  /* Motion */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --duration-fast: 220ms;
  --duration-normal: 420ms;
  --duration-slow: 680ms;
}
```

Google Fonts import:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Space+Mono:wght@400&display=swap"
  rel="stylesheet"
/>
```

---

## 12. Quick checklist for a new ATOMIK-styled app

- [ ] Dark canvas `#231f20`, surfaces `#2b2728` / `#332e2f`
- [ ] Accent `#8e302f`; success ash `#b2beb5` (no green)
- [ ] Montserrat + Space Mono loaded
- [ ] Buttons height 52, radius 10; primary = red fill
- [ ] Cards radius 14, subtle white border
- [ ] Inputs radius 10, red focus ring
- [ ] Badges Space Mono 9 uppercase
- [ ] Tab active = red; inactive = `#6b6869`
- [ ] Horizontal screen padding 20
- [ ] Motion: ease `(0.22, 1, 0.36, 1)`, press scale ~0.97
- [ ] Logo + tagline: Audio Engineering and Design · Service Infrastructure
- [ ] Spelling: **ATOMIK / Atomik** only

---

## 13. Source map (this repo)

| Concern | Path |
|---------|------|
| Colors | `frontend/src/constants/colors.ts` |
| Typography | `frontend/src/constants/typography.ts` |
| Spacing / radius / shadows | `frontend/src/constants/theme.ts` |
| Layout / safe area helpers | `frontend/src/utils/layout.ts` |
| Motion | `frontend/src/utils/motion.ts` |
| Font bootstrap | `frontend/App.tsx` |
| App metadata / splash colors | `frontend/app.config.js` |
| Logo component | `frontend/src/components/common/AtomikLogo.tsx` |
| Button / Input / Card / Badge / Modal | `frontend/src/components/common/` |
| Tab bar | `frontend/src/navigation/tabBarOptions.ts` |
| Splash brand moment | `frontend/src/screens/auth/SplashScreen.tsx` |
| Legal naming | `frontend/src/constants/legalContent.ts` |
| Assets | `frontend/assets/` |

---

*Generated from the ATOMIK Audio service app design tokens. Prefer updating this guide when `colors.ts`, `typography.ts`, or `theme.ts` change.*
