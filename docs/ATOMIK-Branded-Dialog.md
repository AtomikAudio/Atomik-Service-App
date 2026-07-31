# ATOMIK Branded Dialog Box

Reusable confirm / alert dialog pattern from the ATOMIK Service App. Use this to recreate the same look in other projects (React Native, Expo, or web).

Canonical implementation: `frontend/src/components/common/ThemedConfirmModal.tsx`  
Related brand tokens: [`ATOMIK-Brand-Guide.md`](./ATOMIK-Brand-Guide.md)

---

## 1. Variants

| Variant | Component | Buttons | Typical use |
|---------|-----------|---------|-------------|
| **Confirm** | `ThemedConfirmModal` / `BrandConfirmModal` | Primary + Secondary | Logout, cancel booking, assign, pay extra parts |
| **Alert** | `ThemedAlertModal` / `BrandAlertModal` | Primary only | Service completed, success / info |

Both share the same card, icon circle, typography, and colors.

---

## 2. Anatomy

```
┌───────────────────────────┐   ← card: surface #2b2728, radius 12, maxWidth 340
│          ( ◉ )            │   ← icon circle: 68px, red-muted fill, red icon 36px
│        Title (bold)       │   ← Montserrat Bold 18, white, centered
│   Supporting message…     │   ← Montserrat Regular 13, gray, centered
│  ┌─────────────────────┐  │
│  │   PRIMARY ACTION    │  │   ← red #8e302f, height 48, radius 8, letter-spacing 1.5
│  └─────────────────────┘  │
│  ┌─────────────────────┐  │
│  │      SECONDARY      │  │   ← outline only (confirm variant only)
│  └─────────────────────┘  │
└───────────────────────────┘
     dim scrim rgba(0,0,0,0.72)
```

---

## 3. Design spec

| Part | Value |
|------|-------|
| Overlay / scrim | `rgba(0,0,0,0.72)`, tap-to-dismiss, `paddingHorizontal: 28` |
| Card | bg `#2b2728`, border `rgba(255,255,255,0.08)`, radius `12`, maxWidth `340`, pad `24` / top `28` / bottom `20` |
| Icon circle | `68×68`, radius `34`, fill `rgba(142,48,47,0.15)`, border `rgba(142,48,47,0.5)`, Ionicon `36` in `#8e302f` |
| Title | Montserrat Bold, `18`, white, centered |
| Message | Montserrat Regular, `13`, `#a09f9f`, centered, lineHeight `20` |
| Primary button | `#8e302f`, height `48`, radius `8`, Montserrat Bold `12`, white, letter-spacing `1.5`, label **UPPERCASE** |
| Destructive primary | `#6e2524` (`redDark`) |
| Secondary button | transparent, `1px` border `rgba(255,255,255,0.08)`, height `44`, Montserrat SemiBold `12`, `#c8c7c7`, letter-spacing `1.2` |
| Loading | primary shows white spinner; buttons disabled; opacity `0.7` |
| Animation | fade in/out; transparent modal |

### Behaviour

- Tap scrim or Android back = cancel / close (blocked while `loading`)
- Card body taps must not dismiss (`stopPropagation`)
- Icon is configurable per use case

### Suggested icons

| Intent | Ionicon |
|--------|---------|
| Success / completed | `checkmark-circle-outline` |
| Warning / confirm | `alert-circle-outline` |
| Logout | `log-out-outline` |
| Payment | `card-outline` |
| Person / assign | `person-circle-outline` |

---

## 4. Color tokens (dialog only)

| Token | Value | Use |
|-------|--------|-----|
| Scrim | `rgba(0,0,0,0.72)` | Overlay |
| Surface | `#2b2728` | Card |
| Border | `rgba(255,255,255,0.08)` | Card + secondary btn |
| Red | `#8e302f` | Primary CTA + icon |
| Red dark | `#6e2524` | Destructive confirm |
| Red muted | `rgba(142,48,47,0.15)` | Icon circle fill |
| Border active | `rgba(142,48,47,0.5)` | Icon circle border |
| White | `#ffffff` | Title + primary label |
| Gray | `#a09f9f` | Message |
| Gray light | `#c8c7c7` | Secondary label |

---

## 5. Do / don’t

- **Do** keep the card dark (`#2b2728`), not pure black.
- **Do** use red only for the primary / destructive action and the icon.
- **Do** keep button labels short and UPPERCASE.
- **Don’t** use green for success on this dialog — success is the checkmark icon; button stays brand red.
- **Don’t** add purple glow, neon, pills, or light/cream themes.
- **Don’t** stack more than two actions (primary + optional secondary).

---

## 6. Drop-in React Native / Expo component

Dependencies: `react-native`, `@expo/vector-icons`. Colors are inlined so you can paste into any project.

```tsx
import React from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = {
  scrim: 'rgba(0,0,0,0.72)',
  surface: '#2b2728',
  border: 'rgba(255,255,255,0.08)',
  red: '#8e302f',
  redDark: '#6e2524',
  redMuted: 'rgba(142,48,47,0.15)',
  borderActive: 'rgba(142,48,47,0.5)',
  white: '#ffffff',
  gray: '#a09f9f',
  grayLight: '#c8c7c7',
};

type IconName = keyof typeof Ionicons.glyphMap;

/** Two-button confirm dialog */
export function BrandConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'KEEP',
  destructive = false,
  loading = false,
  icon = 'alert-circle-outline',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  icon?: IconName;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
    >
      <Pressable
        style={s.overlay}
        onPress={loading ? undefined : onCancel}
      >
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <View style={s.iconWrap}>
            <Ionicons name={icon} size={36} color={C.red} />
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <TouchableOpacity
            style={[
              s.primaryBtn,
              destructive && s.destructiveBtn,
              loading && s.disabled,
            ]}
            onPress={onConfirm}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Text style={s.primaryText}>{confirmLabel}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={onCancel}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={s.secondaryText}>{cancelLabel}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Single-button success / info dialog */
export function BrandAlertModal({
  visible,
  title,
  message,
  buttonLabel = 'OK',
  icon = 'checkmark-circle-outline',
  onClose,
}: {
  visible: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  icon?: IconName;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <View style={s.iconWrap}>
            <Ionicons name={icon} size={36} color={C.red} />
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={s.primaryText}>{buttonLabel}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: C.redMuted,
    borderWidth: 1,
    borderColor: C.borderActive,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: C.white,
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: C.gray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 8,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  destructiveBtn: {
    backgroundColor: C.redDark,
  },
  disabled: {
    opacity: 0.7,
  },
  primaryText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: C.white,
    letterSpacing: 1.5,
  },
  secondaryBtn: {
    alignSelf: 'stretch',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: C.grayLight,
    letterSpacing: 1.2,
  },
});
```

### Usage examples

```tsx
<BrandAlertModal
  visible={done}
  title="Service completed"
  message="Your technician has completed the booking. Thank you for choosing ATOMIK."
  buttonLabel="OKAY"
  icon="checkmark-circle-outline"
  onClose={() => setDone(false)}
/>

<BrandConfirmModal
  visible={confirmLogout}
  title="Log out?"
  message="Are you sure you want to log out of your account?"
  confirmLabel="LOG OUT"
  cancelLabel="STAY"
  destructive
  icon="log-out-outline"
  onConfirm={doLogout}
  onCancel={() => setConfirmLogout(false)}
/>
```

---

## 7. Web / CSS cheat sheet

```css
:root {
  --dialog-scrim: rgba(0, 0, 0, 0.72);
  --dialog-surface: #2b2728;
  --dialog-border: rgba(255, 255, 255, 0.08);
  --dialog-red: #8e302f;
  --dialog-red-dark: #6e2524;
  --dialog-red-muted: rgba(142, 48, 47, 0.15);
  --dialog-border-active: rgba(142, 48, 47, 0.5);
  --dialog-white: #ffffff;
  --dialog-gray: #a09f9f;
  --dialog-gray-light: #c8c7c7;
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--dialog-scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 28px;
}

.dialog-card {
  width: 100%;
  max-width: 340px;
  background: var(--dialog-surface);
  border: 1px solid var(--dialog-border);
  border-radius: 12px;
  padding: 28px 24px 20px;
  text-align: center;
}

.dialog-icon {
  width: 68px;
  height: 68px;
  margin: 0 auto 16px;
  border-radius: 34px;
  background: var(--dialog-red-muted);
  border: 1px solid var(--dialog-border-active);
  display: grid;
  place-items: center;
  color: var(--dialog-red);
  font-size: 36px;
}

.dialog-title {
  font-family: Montserrat, system-ui, sans-serif;
  font-weight: 700;
  font-size: 18px;
  color: var(--dialog-white);
  margin-bottom: 10px;
}

.dialog-message {
  font-family: Montserrat, system-ui, sans-serif;
  font-weight: 400;
  font-size: 13px;
  line-height: 20px;
  color: var(--dialog-gray);
  margin-bottom: 22px;
}

.dialog-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 8px;
  background: var(--dialog-red);
  color: var(--dialog-white);
  font-family: Montserrat, system-ui, sans-serif;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-bottom: 10px;
  cursor: pointer;
}

.dialog-primary.is-destructive {
  background: var(--dialog-red-dark);
}

.dialog-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 44px;
  border-radius: 8px;
  border: 1px solid var(--dialog-border);
  background: transparent;
  color: var(--dialog-gray-light);
  font-family: Montserrat, system-ui, sans-serif;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  cursor: pointer;
}
```

---

## 8. Porting checklist

1. Load **Montserrat** (Regular 400, SemiBold 600, Bold 700) — or map `fontFamily` to your stack.
2. Use **Ionicons** (or equivalent outline icons) at **36px** in brand red.
3. Keep max card width **340**, radius **12**, primary height **48**.
4. Prefer **confirm** for irreversible / two-choice actions; **alert** for acknowledgment only.
5. Pair destructive confirms with `redDark` and clear copy (`LOG OUT`, `CANCEL BOOKING`, etc.).

---

## 9. Source in this repo

| Item | Path |
|------|------|
| Confirm + Alert components | `frontend/src/components/common/ThemedConfirmModal.tsx` |
| Colors | `frontend/src/constants/colors.ts` |
| Full brand guide | `docs/ATOMIK-Brand-Guide.md` |

---

*Extracted from the ATOMIK Audio service app dialog pattern for reuse across projects.*
