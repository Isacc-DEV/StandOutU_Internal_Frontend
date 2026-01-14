# Images Directory

This directory is for storing images used in the Home and About Us pages.

## Image Requirements

### For Home Page (`/`)

#### 1. Hero Background Image (Optional)
- **File name**: `hero-background.jpg` or `hero-background.webp`
- **Dimensions**: 1920x1080px or larger
- **Format**: JPG, WebP, or PNG
- **Style**: Abstract/digital workspace illustration or gradient overlay
- **Theme**: Modern, tech-focused, dark theme compatible
- **Purpose**: Hero section background (can be gradient-only if preferred - currently using CSS gradients)

#### 2. Feature Icons/Illustrations (6 images) - Optional
Currently using Lucide React icons, but custom illustrations can be added if desired:
- **File names**: 
  - `icon-resume.svg` or `icon-resume.png`
  - `icon-autofill.svg` or `icon-autofill.png`
  - `icon-workspace.svg` or `icon-workspace.png`
  - `icon-joblinks.svg` or `icon-joblinks.png`
  - `icon-community.svg` or `icon-community.png`
  - `icon-calendar.svg` or `icon-calendar.png`
- **Dimensions**: 64x64px to 128x128px (SVG preferred, or PNG with transparency)
- **Format**: SVG (preferred) or PNG with transparent background
- **Style**: Modern, minimalist icons matching the platform's tech aesthetic
- **Features to illustrate**:
  - Resume/document icon
  - Job application/autofill icon
  - Workspace/dashboard icon
  - Job links/tracking icon
  - Community/team icon
  - Calendar icon

#### 3. Platform Screenshot/Mockup (Optional)
- **File name**: `platform-screenshot.jpg` or `platform-dashboard.png`
- **Dimensions**: 1200x800px or similar
- **Format**: JPG or PNG
- **Style**: Professional, clean interface view
- **Purpose**: Show platform in action (if you want to showcase the actual product)

### For About Us Page (`/about`)

#### 1. About Hero Image (Optional)
- **File name**: `about-hero.jpg` or `about-hero.webp`
- **Dimensions**: 1920x600px or similar
- **Format**: JPG, WebP, or PNG
- **Style**: Team photo, office image, or abstract professional illustration
- **Theme**: Professional, welcoming, dark theme compatible
- **Purpose**: Hero section visual (currently using text-only hero)

#### 2. Team Photos (If including team section)
- **File names**: `team-member-[name].jpg` or `team-[name].png`
- **Dimensions**: 200x200px each (square format recommended)
- **Format**: JPG or PNG
- **Style**: Consistent, professional headshots
- **Quantity**: Based on how many team members to showcase
- **Note**: Update the About page component to include these images if team photos are added

#### 3. Values/Concept Illustrations (Optional)
- **File names**:
  - `value-innovation.svg` or `value-innovation.png`
  - `value-user-centric.svg` or `value-user-centric.png`
  - `value-transparency.svg` or `value-transparency.png`
  - `value-collaboration.svg` or `value-collaboration.png`
- **Dimensions**: 64x64px to 96x96px
- **Format**: SVG (preferred) or PNG with transparent background
- **Style**: Clean, modern icons
- **Quantity**: 4 images (currently using Lucide React icons)

## Current Implementation Status

✅ **Current Status**: The pages are implemented using:
- CSS gradients for backgrounds (no background images required)
- Lucide React icons for all feature icons and value icons
- Text-only hero sections (no hero images required)

## Usage Notes

1. **Images are optional**: All current implementations work without custom images
2. **Image optimization**: If you add images, consider using Next.js `Image` component for optimization
3. **File formats**: 
   - Use SVG for icons (scalable, small file size)
   - Use WebP for photos (better compression)
   - Use PNG for images requiring transparency
   - Use JPG for photographs
4. **Responsive images**: Consider providing multiple sizes for responsive design if using Next.js Image component
5. **Dark theme**: All images should work well with the dark theme (#0b1224 background)

## Adding Images

If you want to add custom images:

1. Place the image files in this directory (`public/images/`)
2. Update the relevant page component to use the images
3. For Next.js Image component, use: `/images/filename.ext`
4. For regular img tags, use: `/images/filename.ext`

Example usage in components:
```tsx
// Using Next.js Image component (recommended)
import Image from 'next/image';
<Image src="/images/hero-background.jpg" alt="Hero background" width={1920} height={1080} />

// Using regular img tag
<img src="/images/hero-background.jpg" alt="Hero background" />
```
