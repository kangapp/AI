#!/usr/bin/env node
/**
 * Theme Clone Extractor
 * Uses Playwright to visit URL and extract computed styles.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const EXTRACTION_SCRIPT = `
(function() {
  const results = {
    colors: [],
    typography: [],
    spacing: [],
    borderRadius: [],
    shadows: [],
    metadata: {}
  };

  // Extract all visible elements
  const elements = document.querySelectorAll('*');
  const seenStyles = new Set();

  elements.forEach(el => {
    const style = window.getComputedStyle(el);

    // Colors
    const bgColor = style.backgroundColor;
    const color = style.color;
    const borderColor = style.borderColor;

    [bgColor, color, borderColor].forEach(c => {
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent' && !seenStyles.has(c)) {
        seenStyles.add(c);
        results.colors.push({
          value: c,
          type: c === bgColor ? 'background' : c === color ? 'foreground' : 'border'
        });
      }
    });

    // Typography
    const fontFamily = style.fontFamily;
    const fontSize = style.fontSize;
    const fontWeight = style.fontWeight;
    const lineHeight = style.lineHeight;

    if (fontFamily && !seenStyles.has('font:' + fontFamily)) {
      seenStyles.add('font:' + fontFamily);
      results.typography.push({
        fontFamily,
        fontSize,
        fontWeight,
        lineHeight
      });
    }

    // Spacing
    const margin = style.margin;
    const padding = style.padding;
    const gap = style.gap;

    if (margin && margin !== '0px' && !seenStyles.has('margin:' + margin)) {
      seenStyles.add('margin:' + margin);
      results.spacing.push({ type: 'margin', value: margin });
    }
    if (padding && padding !== '0px' && !seenStyles.has('padding:' + padding)) {
      seenStyles.add('padding:' + padding);
      results.spacing.push({ type: 'padding', value: padding });
    }
    if (gap && gap !== 'normal' && gap !== '0px' && !seenStyles.has('gap:' + gap)) {
      seenStyles.add('gap:' + gap);
      results.spacing.push({ type: 'gap', value: gap });
    }

    // Border Radius
    const borderRadius = style.borderRadius;
    if (borderRadius && borderRadius !== '0px' && !seenStyles.has('br:' + borderRadius)) {
      seenStyles.add('br:' + borderRadius);
      results.borderRadius.push(borderRadius);
    }

    // Shadows
    const boxShadow = style.boxShadow;
    if (boxShadow && boxShadow !== 'none' && !seenStyles.has('shadow:' + boxShadow)) {
      seenStyles.add('shadow:' + boxShadow);
      results.shadows.push(boxShadow);
    }
  });

  // Get viewport info
  results.metadata = {
    url: window.location.href,
    title: document.title,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  };

  return results;
})()
`;

async function extractFromUrl(url, options = {}) {
  const {
    outputPath = './extracted-theme.json',
    fullPage = false,
    timeout = 30000
  } = options;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  try {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout });

    console.log('Extracting computed styles...');
    const results = await page.evaluate(EXTRACTION_SCRIPT);

    // Take screenshot
    const screenshotPath = outputPath.replace('.json', '-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage });
    results.screenshotPath = screenshotPath;

    // Cluster and analyze colors
    results.analysis = analyzeExtractedData(results);

    // Save results
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Extraction complete. Results saved to ${outputPath}`);

    return results;
  } finally {
    await browser.close();
  }
}

function analyzeExtractedData(data) {
  return {
    primaryColor: findMostFrequentColor(data.colors),
    colorPalette: clusterColors(data.colors),
    typography: deduplicateTypography(data.typography),
    spacingSystem: deriveSpacingSystem(data.spacing),
    borderRadiusScale: [...new Set(data.borderRadius)].sort(),
    shadowScale: [...new Set(data.shadows)]
  };
}

function findMostFrequentColor(colors) {
  // Simplified: return the most saturated color that appears as background
  const bgColors = colors.filter(c => c.type === 'background');
  return bgColors.length > 0 ? bgColors[0].value : colors[0]?.value || null;
}

function clusterColors(colors) {
  // Placeholder for color clustering algorithm
  const uniqueColors = [...new Set(colors.map(c => c.value))];
  return uniqueColors.slice(0, 10); // Return top 10 unique colors
}

function deduplicateTypography(typography) {
  const unique = new Map();
  typography.forEach(t => {
    const key = t.fontFamily;
    if (!unique.has(key)) {
      unique.set(key, t);
    }
  });
  return Object.values(unique);
}

function deriveSpacingSystem(spacing) {
  // Extract numeric spacing values and find common pattern
  const values = [...new Set(spacing)];
  return values.slice(0, 8);
}

// CLI
if (require.main === module) {
  const url = process.argv[2];
  const outputPath = process.argv[3] || './extracted-theme.json';

  if (!url) {
    console.error('Usage: node extractor.js <url> [output-path]');
    process.exit(1);
  }

  extractFromUrl(url, { outputPath })
    .then(results => {
      console.log(JSON.stringify(results.analysis, null, 2));
    })
    .catch(err => {
      console.error('Extraction failed:', err);
      process.exit(1);
    });
}

module.exports = { extractFromUrl, analyzeExtractedData };
