---
name: Studio & Barber Modern Editorial Booking
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daea'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eefe'
  surface-container-high: '#e2e8f8'
  surface-container-highest: '#dce2f3'
  on-surface: '#151c27'
  on-surface-variant: '#444748'
  inverse-surface: '#2a313d'
  inverse-on-surface: '#ebf1ff'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#101e1a'
  on-tertiary-container: '#778781'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474746'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#d5e6df'
  tertiary-fixed-dim: '#bacac3'
  on-tertiary-fixed: '#101e1a'
  on-tertiary-fixed-variant: '#3b4a44'
  background: '#f9f9ff'
  on-background: '#151c27'
  surface-variant: '#dce2f3'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  display-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
  label-pill:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system expresses a refined, architectural minimalism tailored for modern studio and barbershop appointment platforms. It balances utility and understated luxury, conveying trust, punctuality, and craft.

The visual direction draws from high-contrast editorial layouts and contemporary Swiss design principles:
- **Clean Structure:** Generous negative space, rhythmic grid alignment, and crisp divider architecture.
- **Monochrome Foundation:** Deep charcoal-black and pure white surface layering, allowing content, dates, and action states to take center stage.
- **Organic Accentuation:** Targeted sage and emerald tones reserved exclusively for status cues, confirmed availability, and reassurance markers.
- **Deliberate Tactility:** Subtly rounded containers, crisp 1px hair-line borders, and micro-elevation cues on active selections.

## Colors

The palette employs a predominantly monochromatic hierarchy with deliberate, highly specific use of green accents for positive availability states.

- **Primary (`#1A1A1A`):** Used for solid brand identity, high-emphasis headlines, active calendar states, and primary conversion buttons.
- **Secondary (`#10B981`):** Applied exclusively to positive availability indicators, status dots, and text badges indicating available slots.
- **Tertiary / Soft Tint (`#ECFDF5`):** Reserved for badge fills, availability pill backgrounds, and subtle affirmative highlights.
- **Neutral (`#6B7280`):** Provides legibility for secondary descriptions, metadata, and day-of-week table labels.
- **Base Canvas & Borders:**
  - Page Background: `#F8F9FA`
  - Container Surfaces: `#FFFFFF`
  - Subtle Borders & Dividers: `#E9ECEF`
  - Muted Inactive Day States: `#F3F4F6`

## Typography

The typography leverages `Plus Jakarta Sans` across all roles to achieve a warm geometric aesthetic that feels contemporary and balanced.

- **Display & Main Titles:** High-density, tight tracking (`-0.03em`) creates crisp editorial confidence for page titles.
- **Section Headers & Steps:** Clear step tracking (`PASSAGGIO 1`, `ORARIO DISPONIBILE`) utilizes the uppercase `label-caps` token with generous letter spacing (`0.08em`) to guide scanning eyes without competing with operational content.
- **Calendar Figures & Slot Hours:** Rendered in medium to bold weights to facilitate effortless date/time scanning under varied lighting conditions.

## Layout & Spacing

The layout model is organized around a dual-pane orchestration workflow within a central max-width content shell (`1200px`):

- **Desktop (>= 1024px):** A balanced two-column card structure with calendar selection situated on the primary left pane (50–55% width) and time slot configuration/summary on the right pane (45–50% width), bounded by a central vertical hairline separator.
- **Tablet (768px – 1023px):** Fluid single-column progression where step 1 precedes slot selection with `1.5rem` vertical spacing.
- **Mobile (< 768px):** Sticky bottom navigation container holding the action CTA, full-width step accordions, and touch targets constrained to a minimum height of `48px`.
- **Rhythm:** Internal component spacing follows an 8-point harmonic grid, using `0.5rem` for micro-elements, `1rem` for card padding and field insets, and `1.5rem` to `2.5rem` for major section delineation.

## Elevation & Depth

Visual separation relies on clean surface layering and low-contrast outlines rather than heavy atmospheric drop shadows:

- **Level 0 (Canvas):** Tone `#F8F9FA` serves as the resting canvas.
- **Level 1 (Card Panels & Shells):** Elevated using `#FFFFFF` fill with a crisp `1px solid #E9ECEF` boundary and a soft, diffused shadow (`0px 4px 20px rgba(0, 0, 0, 0.02)`).
- **Level 2 (Interactive Buttons & Slots):** Outlined with `1px solid #E9ECEF` in resting states; switches to solid `#1A1A1A` with subtle lift (`0px 2px 8px rgba(0, 0, 0, 0.08)`) when selected.
- **Level 3 (Overlay / Sticky Summary):** Bordered surface with `0px 8px 30px rgba(0, 0, 0, 0.06)` for mobile bottom bars and floating status notifications.

## Shapes

The design system maintains geometric cohesion with rounded corners balanced across structural tiers:

- **Outer Shells & Major Cards:** 1rem (`rounded-lg`) corner radii create a unified, self-contained architecture.
- **Time Slot Cells & Selection Cards:** 0.5rem to 0.75rem radii offer tactile clarity for interactive items.
- **Badges & Notice Pills:** Fully curved pill form (`9999px` border radius) distinguishes meta-information (e.g., "8 orari liberi" or "Prenotazione senza pagamento anticipato") from clickable layout blocks.
- **Calendar Date Cells:** Uniform square proportions with smooth 0.5rem inner curvature for current day states and active highlight rings.

## Components

### Buttons
- **Primary Action:** Solid `#1A1A1A` background, white text (`Plus Jakarta Sans`, 600 weight), height `52px`, rounded corner radius `0.75rem`. Accompanied by inline directional iconography (e.g. subtle rightward arrow) spaced `0.5rem` from the text.
- **Secondary / Slot Buttons:** White background, `1px solid #E9ECEF` border, `#1A1A1A` text. Hover transitions to `#F8F9FA` border `#D1D5DB`. Selected state shifts to `#1A1A1A` fill with pure white label and icon tint.
- **Icon Steppers (e.g., month navigation):** Circular or soft-square (`36px × 36px`) border-framed buttons with central glyphs.

### Chips & Status Pills
- **Availability Badge:** Filled with `#ECFDF5`, containing `#10B981` text, height `24px`, padding `0 10px`, pill-radius (`9999px`).
- **Notice Badge (Header):** Outlined in `#E9ECEF` with neutral `#6B7280` text, uppercase style, tracking `0.05em`.
- **Selected Time Indicator:** Inline dot indicator (`#10B981`, `6px × 6px`) followed by the summary timestamp.

### Calendar Grid
- **Day Headers:** Monospaced or uppercase `label-caps` (`LUN`, `MAR`, `MER`), centered, `#6B7280`.
- **Standard Day Cell:** Clean centered numeral, minimum touch area `40px × 40px`.
- **Today Marker:** Highlighted with soft gray background (`#F3F4F6`) and small descriptive label (`oggi`).
- **Active / Selected Day:** Bold `#1A1A1A` pill/container with pure white numeral, accompanied by an accent indicator dot centered underneath.
- **Inactive / Past Days:** Low-contrast neutral (`#D1D5DB`), non-interactive.

### Cards & Service Selector
- **Service Summary Card:** Single-line or compact horizontal tile containing category avatar/glyph on the left, service name and duration/inclusions in the center, and a subtle secondary link (`Modifica`) on the right.
- **Value Proposition Bar (Footer Tiles):** Row of three balanced light cards (`#FFFFFF`, `1px solid #E9ECEF`) highlighting service commitments (e.g., Free Cancellation, No Card Required, Automated Reminder).