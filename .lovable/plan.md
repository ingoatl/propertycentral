
# Designer Pitch Presentation Overhaul

## Overview
Update the Designer Presentation with new before/after images, corrected property data, Ilana's photos, and ElevenLabs-generated audio narration for each slide with a female voice.

---

## 1. Image Updates

### Property Images from Dropbox URLs
The images are hosted on Dropbox (via tinyurl redirects). These need to be downloaded and saved to `src/assets/designer/`:

| Property | Before Image URL | After Image URL |
|----------|------------------|-----------------|
| Whitehurst | `https://tinyurl.com/WhitehurstBefore` | `https://tinyurl.com/WhitehurstAfter` |
| Southvale | `https://tinyurl.com/SouthvaleBefore` | `https://tinyurl.com/SouthvaleAfter` |
| Justice | `https://tinyurl.com/BeforeJustice` | `https://tinyurl.com/JusticeAfter` |
| Lakewood | `https://tinyurl.com/Lakewood-Before` | `https://tinyurl.com/Lakewood-After` |
| Brushy | `https://tinyurl.com/BrushyBefore` | `https://tinyurl.com/BrushyAfter` |
| To Lani | `https://tinyurl.com/ToLaniBefore` | `https://tinyurl.com/ToLaniAfter` |

### Ilana Photos
Copy the 2 uploaded Ilana photos to assets:
- `user-uploads://unnamed_1.jpg` - Ilana styling a living room (gray jacket)
- `user-uploads://unnamed.jpg` - Ilana with hammer (yellow blouse, fun/professional)

Best placement:
- **MeetIlanaSlide.tsx**: Use yellow blouse photo as main headshot (friendly, professional)
- **TransformationProcessSlide.tsx** or **DesignerClosingSlide.tsx**: Add gray jacket photo showing her "in action"

---

## 2. Property Data Corrections

Update `BeforeAfterSlide.tsx` case study data:

| Property | Current | Corrected |
|----------|---------|-----------|
| Southvale | $35K, 2025 | **$25K, 2025** |
| Justice | $25K, 2025 | **$23K, 2024** |
| Lakewood | $23K, 2024 | No change |
| Brushy | $23K, 2024 | No change |
| To Lani | $20K, 2023 | No change |
| Whitehurst | $30K-$40K, 2025 | No change |

### Updated Airbnb Links

| Property | New Airbnb URL |
|----------|----------------|
| Southvale | `https://tinyurl.com/AirBnBSouthvale` |
| Justice | `https://tinyurl.com/AirBnBJustice` |
| Lakewood | `https://tinyurl.com/AirBnBLakewood` |
| Brushy | `https://tinyurl.com/AirBnBBrushy` |
| To Lani | `https://tinyurl.com/AirBnBToLani` |

---

## 3. Audio Narration System

### Architecture
The project uses pre-generated audio stored in Supabase Storage at:
`message-attachments/presentation-audio/{presentation}/{slideId}.mp3`

For the designer presentation, we need to:
1. Extend `useStoredPresentationAudio.ts` to support `"designer"` presentation type
2. Generate audio files using ElevenLabs TTS via the existing `elevenlabs-tts` edge function
3. Upload MP3 files to Supabase Storage

### Voice Selection
Use **Sarah** voice (EXAVITQu4vr4xnSDxMaL) - female, warm, professional (same as Owner Portal presentation)

### Narration Scripts (Owner's Perspective)
Each script is written to persuade a property owner considering Ilana's design services:

| Slide ID | Script |
|----------|--------|
| `title` | "Welcome. PeachHaus has partnered with Handy Honey to offer you something special: professional design and staging services that transform your property into a booking magnet." |
| `meet-ilana` | "Meet Ilana Weismark, the creative force behind Handy Honey. With 15 years of home staging experience, Ilana specializes in transforming rental properties into stunning spaces that command premium rates. Her motto? Sweet fixes without the nagging. She handles everything from design to installation, so you don't have to lift a finger." |
| `why-design` | "In today's competitive rental market, first impressions are everything. Properties with professional staging command 20 to 40 percent higher nightly rates and receive three times more listing clicks. Design isn't an expense. It's an investment with measurable returns." |
| `process` | "Ilana's process is simple and stress-free. It starts with a consultation walkthrough, followed by a custom design plan with budget options. She handles all sourcing, coordinates installation, and delivers your property photo-ready. Average timeline is 2 to 6 weeks depending on scope." |
| `case-whitehurst` | "Take a look at Whitehurst in Marietta. This property received a complete transformation with an investment of 30 to 40 thousand dollars. The result? A stunning, modern space that photographs beautifully and attracts premium guests. You can verify this listing live on Airbnb." |
| `case-southvale` | "Southvale started as an empty shell. With a 25 thousand dollar investment in 2025, Ilana transformed it into a cohesive, guest-focused retreat. Notice the modern aesthetic, the coordinated furnishings, and the attention to detail that makes guests feel at home." |
| `case-justice` | "Justice is a perfect example of high-impact design on a modest budget. Just 23 thousand dollars in 2024 created this warm, inviting living space. The stone fireplace becomes a stunning focal point, and the color coordination throughout creates a memorable guest experience." |
| `case-lakewood` | "Lakewood shows what's possible with smart design choices. An investment of 23 thousand dollars in 2024 turned empty rooms into warm, cozy spaces with a functional layout. Twin beds maximize flexibility for different guest configurations." |
| `case-brushy` | "Brushy underwent a complete renovation, transforming from a construction zone into an elegant home. For 23 thousand dollars in 2024, Ilana created photo-ready spaces with natural elements and inviting atmospheres that photograph beautifully." |
| `case-tolani` | "To Lani proves that thoughtful design doesn't require a massive budget. With just 20 thousand dollars in 2023, Ilana created this stunning bedroom with a signature accent wall, curated artwork, and cohesive styling that consistently earns five-star reviews." |
| `investment` | "Investment levels range from 5 thousand for a room refresh, to 10 thousand for full staging from scratch, up to 20 to 40 thousand for a premium overhaul. Design fees cover consultation, sourcing, project management, and installation. Furniture is purchased separately at cost with no markups." |
| `faq` | "Common questions: Projects typically take 2 to 6 weeks. You don't need to be present during installation. Ilana can work with your existing furniture or recommend replacements. And most owners recoup their investment within 6 to 12 months." |
| `closing` | "Ready to transform your property? Schedule a free consultation with Ilana to discuss your vision. She handles everything, coordinating directly with PeachHaus. Call 770-312-6723 or visit handyhoney.net. Design is not just an expense. It's an investment with measurable ROI." |

---

## 4. File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src/assets/designer/whitehurst-before-new.jpg` | New Whitehurst before photo |
| `src/assets/designer/whitehurst-after-new.jpg` | New Whitehurst after photo |
| `src/assets/designer/southvale-before-new.jpg` | New Southvale before photo |
| `src/assets/designer/southvale-after-new.jpg` | New Southvale after photo |
| `src/assets/designer/justice-before-new.jpg` | New Justice before photo |
| `src/assets/designer/justice-after-new.jpg` | New Justice after photo |
| `src/assets/designer/lakewood-before-new.jpg` | New Lakewood before photo |
| `src/assets/designer/lakewood-after-new.jpg` | New Lakewood after photo |
| `src/assets/designer/brushy-before-new.jpg` | New Brushy before photo |
| `src/assets/designer/brushy-after-new.jpg` | New Brushy after photo |
| `src/assets/designer/tolani-before-new.jpg` | New To Lani before photo |
| `src/assets/designer/tolani-after-new.jpg` | New To Lani after photo |
| `src/assets/designer/ilana-action.jpg` | Ilana styling (gray jacket) |
| `src/assets/designer/ilana-fun.jpg` | Ilana with hammer (yellow) |

### Modified Files
| File | Changes |
|------|---------|
| `src/components/presentation/designer-slides/BeforeAfterSlide.tsx` | Update image imports, Airbnb URLs, budget/year data |
| `src/components/presentation/designer-slides/MeetIlanaSlide.tsx` | Use new Ilana headshot (yellow blouse) |
| `src/hooks/useStoredPresentationAudio.ts` | Add "designer" to presentation type union |
| `src/pages/DesignerPresentation.tsx` | Add audio system with slide scripts, auto-play, controls |

---

## 5. Technical Implementation Details

### Step 1: Copy Images
Download images from Dropbox URLs and copy Ilana photos to `src/assets/designer/`

### Step 2: Update BeforeAfterSlide.tsx
- Update import statements to use new image files
- Correct budget/year for Southvale and Justice
- Update all Airbnb URLs to tinyurl versions

### Step 3: Update MeetIlanaSlide.tsx
- Replace headshot with new Ilana photo (yellow blouse)
- Optionally add second photo showing her "in action"

### Step 4: Extend Audio Hook
Update `useStoredPresentationAudio.ts` type:
```typescript
presentation: "onboarding" | "owner-portal" | "designer";
```

### Step 5: Update DesignerPresentation.tsx
- Add slide scripts as shown in the narration table
- Import and integrate `useStoredPresentationAudio`
- Add audio controls (mute, play/pause)
- Add auto-advance logic matching OnboardingPresentation pattern
- Add touch swipe support for mobile

### Step 6: Generate Audio Files
Use ElevenLabs TTS edge function to generate MP3 files for each slide:
- Voice: Sarah (EXAVITQu4vr4xnSDxMaL)
- Upload to: `message-attachments/presentation-audio/designer/{slideId}.mp3`

---

## 6. Verification Steps
1. Open browser and navigate to `/designer-presentation`
2. Verify each slide displays correct before/after images
3. Verify Ilana photos appear in appropriate slides
4. Verify audio plays for each slide with female narrator
5. Verify Airbnb links navigate to correct listings
6. Test mobile swipe navigation
7. Test mute/unmute functionality
