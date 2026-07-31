# ATOMIK Branded Dialog Box Guide

Reusable spec for the ATOMIK confirm / alert dialog used across the Service App (e.g. Service completed, Technician assigned, Log out, Extra parts payment due).

Copy this into other ATOMIK projects so dialogs stay on brand.

**Living source in this repo:** `frontend/src/components/common/ThemedConfirmModal.tsx`  
**Full brand tokens:** `docs/ATOMIK-Brand-Guide.md`

---

## 1. Variants

| Variant | Component | Buttons | Typical use |
|---------|-----------|---------|-------------|
| **Confirm** | `ThemedConfirmModal` / `BrandConfirmModal` | Primary + Secondary | Assign, cancel, logout, pay now / okay |
| **Alert** | `ThemedAlertModal` / `BrandAlertModal` | Primary only | Service completed, success / info |

Both share the same card, icon circle, typography, and scrim.

---

## 2. Anatomy

```
┌───────────────────────────┐   card: surface #2b2728, radius 12, maxWidth 340
│          ( ◉ )            │   icon circle: 68px, red-muted fill, red icon 36px
│        Title (bold)       │   Montserrat Bold 18, white, centered
│   Supporting message…     │   Montserrat Regular 13, gray, centered, lineHeight 20
│  ┌─────────────────────┐  │
│  │   PRIMARY ACTION    │  │   red #8e302f, height 48, radius 8, letter-spacing 1.5
│  └─────────────────────┘  │
│  ┌─────────────────────┐  │
│  │      SECONDARY      │  │   outline only, gray text (confirm variant only)
│  └─────────────────────┘  │
└───────────────────────────┘
     dim scrim rgba(0,0,0,0.72)
```

---

## 3. Design tokens

| Part | Value |
|------|--------|
| Overlay / scrim | `rgba(0,0,0,0.72)`, tap-to-dismiss, `paddingHorizontal: 28` |
| Card background | `#2b2728` (`surface`) |
| Card border | `rgba(255,255,255,0.08)` (`border`), width `1` |
| Card radius | `12` |
| Card max width | `340` |
| Card padding | horizontal `24`, top `28`, bottom `20` |
| Icon circle | `68×68`, radius `34` |
| Icon circle fill | `rgba(142,48,47,0.15)` (`redMuted`) |
| Icon circle border | `rgba(142,48,47,0.5)` (`borderActive`) |
| Icon | Ionicons, size `36`, color `#8e302f` (`red`) |
| Title | Montserrat Bold `700`, size `18`, `#ffffff`, centered |
| Message | Montserrat Regular `400`, size `13`, `#a09f9f`, centered, lineHeight `20` |
| Primary button | bg `#8e302f`, height `48`, radius `8` |
| Primary text | Montserrat Bold `12`, white, letter-spacing `1.5`, **UPPERCASE** |
| Destructive primary | bg `#6e2524` (`redDark`) |
| Secondary button | transparent, border `rgba(255,255,255,0.08)`, height `44`, radius `8` |
| Secondary text | Montserrat SemiBold `600`, size `12`, `#c8c7c7`, letter-spacing `1.2` |
| Loading | white `ActivityIndicator` on primary; buttons disabled; opacity `0.7` |
| Animation | `Modal` `fade`, `transparent` |

### Optional icons (examples)

| Intent | Ionicon |
|--------|---------|
| Success / completed | `checkmark-circle-outline` |
| Warning / generic | `alert-circle-outline` |
| Logout | `log-out-outline` |
| Payment | `card-outline` |
| Person / assign | `person-circle-outline` |

---

## 4. Behaviour rules

1. Tap **scrim** or Android back → cancel / close (blocked while `loading`).
2. Tap **card body** → `stopPropagation` (does not dismiss).
3. Button labels are short and **UPPERCASE** (e.g. `OKAY`, `PAY NOW`, `LOG OUT`, `STAY`).
4. Destructive / irreversible confirms use `redDark` on the primary button.
5. Icon stays **red** even for success alerts (ash gray `#b2beb5` is for badges/chips, not this primary button).
6. Copy: short, clear, industrial — no emoji in product chrome.

---

## 5. CSS / web token cheat sheet

```css
:root {
  --atomik-dialog-scrim: rgba(0, 0, 0, 0.72);
  --atomik-dialog-surface: #2b2728;
  --atomik-dialog-border: rgba(255, 255, 255, 0.08);
  --atomik-dialog-radius: 12px;
  --atomik-dialog-max-width: 340px;
  --atomik-red: #8e302f;
  --atomik-red-dark: #6e2524;
  --atomik-red-muted: rgba(142, 48, 47, 0.15);
  --atomik-border-active: rgba(142, 48, 47, 0.5);
  --atomik-white: #ffffff;
  --atomik-gray: #a09f9f;
  --atomik-gray-light: #c8c7c7;
}
```

---

## 6. Drop-in React Native / Expo component

Only dependency beyond React Native: `@expo/vector-icons`.  
Load Montserrat (`@expo-google-fonts/montserrat`) or swap `fontFamily` for your stack.

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

/** Two-button confirm dialog (ATOMIK brand). */
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

/** Single-button success / info dialog (ATOMIK brand). */
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

---

## 7. Usage examples

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

## 8. Porting checklist

- [ ] Dark surface card (`#2b2728`), not pure black
- [ ] Red only on primary / destructive action + icon
- [ ] Uppercase primary labels with letter-spacing
- [ ] Soft white hairline border; no heavy multi-layer shadows
- [ ] No purple gradients, neon glow, or light/cream themes
- [ ] Montserrat (or project equivalent) for UI text
- [ ] Ionicons (or matching outline icon set) in the 68px circle

---

*Extracted from the ATOMIK Audio Service App branded modal pattern. Prefer updating this file when `ThemedConfirmModal.tsx` or brand tokens change.*
