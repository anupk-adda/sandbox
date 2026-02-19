# pace42.ai — Personalized Training Platform Design

## 1. Design Overview

- **Project Name**: pace42.ai  
- **Type**: AI-powered personalized running training platform  
- **Visual Style**: sleek, data-driven, futuristic, premium athletic-tech  
- **Primary Headline/Tagline**: **"Your run. Your plan. Your progress."**

The experience showcases how pace42 transforms raw running data into intelligent, adaptive training plans that evolve with every run.

---

## 2. Visual Identity

### Color System

Background Primary:   `#0A0C0F` (deep space black)  
Background Secondary: `#111418` (elevated surface)  
Accent:               `#00D4AA` (neon teal — data/insights)  
Accent Secondary:     `#FF6B35` (warm orange — alerts/effort)  
Text Primary:         `#FFFFFF`  
Text Secondary:       `rgba(255,255,255,0.65)`  
Data Grid:            `rgba(0,212,170,0.15)` (subtle teal lines)

### Typography

- **Headings (Display)**: `Space Grotesk`  
  - Weights: 600–700  
  - H1: `clamp(40px, 5vw, 80px)`  
  - Line-height: `1.0–1.1`  
  - Letter-spacing: `-0.03em`
- **Body**: `Inter`  
  - Weight: 400–500  
  - Size: `clamp(14px, 1.1vw, 18px)`  
  - Line-height: `1.6`
- **Data/Metrics**: `JetBrains Mono`  
  - Weight: 400–500  
  - Size: `12–14px`  
  - Letter-spacing: `0.02em`

### Visual Elements

- **Corners**: 8px for cards, 999px for pills/buttons
- **Data visualization**: subtle grid lines, glowing accent borders
- **Card style**: glassmorphism with subtle border glow
- **No grain texture** — clean, modern tech aesthetic

---

## 3. Section Structure

**Total Sections**: 8

**Section Flow**
1. **Hero** — "Your run. Your plan. Your progress." — **pin: true**
2. **Garmin Connect** — Data import feature — **pin: true**
3. **Weather Intelligence** — Weather-aware training — **pin: true**
4. **Dynamic Adaptation** — Plan evolves with you — **pin: true**
5. **Post-Run Analysis** — After every run insights — **pin: true**
6. **Coaching Tips** — Personalized guidance — **pin: true**
7. **Training Dashboard Preview** — Visual dashboard showcase — **pin: false**
8. **Final CTA** — Join waitlist — **pin: false**

---

## 4. Tech Stack

- **Build Tool**: Vite
- **Framework**: React
- **Animation**: GSAP + ScrollTrigger
- **Icons**: Lucide React

---

## 5. Section-by-Section Design

### Section 1: Hero

**pin**: `true`
**end**: `+=130%`

**Purpose**: Immediate value proposition — personalized training that adapts.

#### Composition
- Full-bleed background: runner at dawn with data overlay aesthetic
- Center content block:
  - Headline: "Your run. Your plan. Your progress."
  - Subheadline: "AI-powered training that adapts to your Garmin data, weather conditions, and how you actually feel."
  - CTA: "Connect your watch" (accent pill)
  - Secondary: "See how it works"
- Floating data cards around edges showing:
  - "Today's pace: 5:32/km"
  - "Weather: 18°C, 65% humidity"
  - "Recovery: 87%"

#### Animation
- **Load**: Headline words stagger in, data cards float in from edges
- **Scroll (70-100%)**: Content fades up and out, next section slides over

---

### Section 2: Garmin Connect

**pin**: `true`
**end**: `+=130%`

**Purpose**: Show seamless Garmin integration.

#### Composition
- Background: close-up of Garmin watch on wrist
- Center card with:
  - Icon: Watch with sync animation
  - Headline: "Your data, automatically"
  - Body: "Connect your Garmin once. We analyze every metric — pace, heart rate, cadence, VO2 max, training load, and recovery — to build your personalized profile."
  - Feature list:
    - "Auto-sync after every run"
    - "Historical trend analysis"
    - "Fitness level detection"
- Visual: Data stream visualization (animated lines flowing from watch icon)

#### Animation
- **Entrance (0-30%)**: Card slides up, data streams draw on
- **Settle (30-70%)**: Subtle pulse animation on sync icon
- **Exit (70-100%)**: Card slides left, fades out

---

### Section 3: Weather Intelligence

**pin**: `true`
**end**: `+=130%`

**Purpose**: Weather-aware training adjustments.

#### Composition
- Background: runner in varying weather conditions (split visual or overlay)
- Center card:
  - Icon: Cloud/sun with data points
  - Headline: "Weather-aware training"
  - Body: "Heat, humidity, wind, and air quality — we factor it all in. Your planned pace automatically adjusts so you train smart, not just hard."
  - Weather widget mockup showing:
    - Current conditions
    - "Adjusted pace: +15s/km" (due to heat)
    - "Hydration reminder: 500ml/hour"

#### Animation
- **Entrance**: Card scales up from center
- **Weather widget**: Numbers count up, icons animate
- **Exit**: Card dissolves into particles/data points

---

### Section 4: Dynamic Adaptation

**pin**: `true`
**end**: `+=140%`

**Purpose**: Show how plans evolve based on performance.

#### Composition
- Background: abstract data visualization / neural network aesthetic
- Center card:
  - Headline: "Plans that evolve with you"
  - Body: "Missed a workout? Crushed a session? Feeling off? Your plan adapts in real-time — not at the end of the week."
  - Visual timeline showing adaptation:
    - Week 1: Base plan
    - Week 2: Adjusted ("You ran faster than target")
    - Week 3: Adjusted ("Added recovery day — you needed it")

#### Animation
- **Entrance**: Timeline draws from left to right
- **Adaptation points**: Pulse/glow when reached
- **Exit**: Timeline compresses, fades up

---

### Section 5: Post-Run Analysis

**pin**: `true`
**end**: `+=130%`

**Purpose**: Immediate insights after every run.

#### Composition
- Background: runner finishing run, looking at watch
- Center card:
  - Headline: "Insights after every run"
  - Body: "Within seconds of saving your activity, get personalized analysis: What went well, what to watch, and how it fits your bigger picture."
  - Mock notification card:
    - "Great job! Your aerobic base is improving."
    - "Pace was 8% faster than target — consider dialing back next easy run."
    - "Cadence looking good: 172 spm average"

#### Animation
- **Entrance**: Notification cards stack in from bottom
- **Settle**: Subtle hover/float animation
- **Exit**: Cards slide off-screen in sequence

---

### Section 6: Coaching Tips

**pin**: `true`
**end**: `+=130%`

**Purpose**: Personalized coaching that grows with you.

#### Composition
- Background: runner on track, focused
- Center card:
  - Headline: "Coaching tips that fit you"
  - Body: "Generic advice doesn't work. Get tips based on your actual data, your goals, and where you are in your training cycle."
  - Tip cards rotating/showing examples:
    - "Your easy runs are too fast. Slow down 20s/km to build aerobic base."
    - "Great cadence! Try increasing stride length on intervals."
    - "You're ready for a long run this weekend."

#### Animation
- **Entrance**: Tip cards fan out
- **Settle**: Cards cycle through (auto-rotate)
- **Exit**: Cards collapse into center, fade out

---

### Section 7: Dashboard Preview (Flowing)

**pin**: `false`

**Purpose**: Show the actual app interface.

#### Composition
- Dark background
- Section heading: "Your training command center"
- Large dashboard mockup showing:
  - Weekly plan view (calendar with runs)
  - Fitness trend graph
  - Today's workout card with weather
  - Recent activities list
  - Recovery status ring

#### Animation
- Scroll-triggered fade and slide up
- Subtle parallax on dashboard elements

---

### Section 8: Final CTA (Flowing)

**pin**: `false`

**Purpose**: Convert — join waitlist or connect watch.

#### Composition
- Full-bleed background: inspiring runner at sunrise
- Center content:
  - Headline: "Ready to train smarter?"
  - Subheadline: "Join thousands of runners who've made every run count."
  - Email input + "Join waitlist" button
  - "Or connect your Garmin now" link
- Footer with social links

---

## 6. Animation System

### Motion Language
- Smooth, purposeful motion (ease: power2.out, power3.out)
- Data elements: subtle glow/pulse
- Cards: float, slide, scale transforms
- No blur effects — clean transforms only

### Scroll Snap
- Snap to pinned section centers only
- Fast snap (0.15-0.35s)
- No delay

---

## 7. Asset Inventory

### Images Required

**hero_runner_data**
- Runner at dawn with data overlay aesthetic
- 16:9, cinematic, high contrast, slightly desaturated

**garmin_watch_closeup**
- Close-up of running watch on wrist
- 16:9, premium product photography style

**weather_runner**
- Runner in varying weather (rain/sun overlay)
- 16:9, atmospheric

**data_visualization_bg**
- Abstract data/neural network visualization
- 16:9, dark with teal accents

**finish_line_runner**
- Runner finishing, checking watch
- 16:9, dynamic, energetic

**focused_runner_track**
- Runner on track, focused expression
- 16:9, motivational

**dashboard_mockup**
- App interface screenshot (can be built in code)

**final_cta_sunrise**
- Runner at sunrise, inspiring
- 16:9, golden hour

---

## 8. Copy Document

### Navigation
- Logo: "pace42"
- Links: "Features", "How it works", "Dashboard"
- CTA: "Join waitlist"

### Section 1 (Hero)
- Headline: "Your run. Your plan. Your progress."
- Sub: "AI-powered training that adapts to your Garmin data, weather conditions, and how you actually feel."
- CTA: "Connect your watch"
- Secondary: "See how it works"

### Section 2 (Garmin)
- Headline: "Your data, automatically"
- Body: "Connect your Garmin once. We analyze every metric — pace, heart rate, cadence, VO2 max, training load, and recovery — to build your personalized profile."
- Features: "Auto-sync after every run", "Historical trend analysis", "Fitness level detection"

### Section 3 (Weather)
- Headline: "Weather-aware training"
- Body: "Heat, humidity, wind, and air quality — we factor it all in. Your planned pace automatically adjusts so you train smart, not just hard."

### Section 4 (Adaptation)
- Headline: "Plans that evolve with you"
- Body: "Missed a workout? Crushed a session? Feeling off? Your plan adapts in real-time — not at the end of the week."

### Section 5 (Post-Run)
- Headline: "Insights after every run"
- Body: "Within seconds of saving your activity, get personalized analysis: What went well, what to watch, and how it fits your bigger picture."

### Section 6 (Coaching)
- Headline: "Coaching tips that fit you"
- Body: "Generic advice doesn't work. Get tips based on your actual data, your goals, and where you are in your training cycle."

### Section 7 (Dashboard)
- Headline: "Your training command center"

### Section 8 (CTA)
- Headline: "Ready to train smarter?"
- Sub: "Join thousands of runners who've made every run count."
- Button: "Join waitlist"
- Link: "Or connect your Garmin now"
