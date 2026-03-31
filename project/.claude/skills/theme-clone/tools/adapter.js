#!/usr/bin/env node
/**
 * Theme Clone Adapter
 * Transforms extracted design tokens to target framework format.
 */

const fs = require('fs');
const path = require('path');

function loadFrameworkRules() {
  const configPath = path.join(__dirname, '..', 'config', 'framework-rules.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function detectFramework(projectPath) {
  const rules = loadFrameworkRules();
  const files = fs.readdirSync(projectPath);

  for (const [frameworkName, frameworkConfig] of Object.entries(rules.frameworks)) {
    const detectors = frameworkConfig.detectors;
    const matches = detectors.filter(d => {
      if (d.includes('*')) {
        // Glob pattern
        const pattern = d.replace('*', '');
        return files.some(f => f.includes(pattern));
      }
      return files.includes(d);
    });

    if (matches.length >= Math.ceil(detectors.length / 2)) {
      return frameworkName;
    }
  }

  return 'css_modules'; // Default fallback
}

function convertToCSSVariables(tokens, framework) {
  const rules = loadFrameworkRules();
  const config = rules.frameworks[framework];
  const mapping = config.variableMapping;

  const cssVars = {};

  // Colors
  if (tokens.colors) {
    tokens.colors.forEach((color, i) => {
      const varName = mapping[`color_${i}`] || `--color-${i}`;
      cssVars[varName] = color.value;
    });
  }

  // Primary color (most important)
  if (tokens.primaryColor) {
    cssVars[mapping.primary] = tokens.primaryColor;
  }

  // Typography
  if (tokens.typography) {
    tokens.typography.forEach((t, i) => {
      cssVars[`--font-${i}`] = t.fontFamily;
    });
  }

  // Border radius
  if (tokens.borderRadiusScale) {
    const radiusVars = tokens.borderRadiusScale.map((r, i) => {
      const name = i === 0 ? 'sm' : i === 1 ? 'md' : i === 2 ? 'lg' : `radius-${i}`;
      return `--radius-${name}: ${r};`;
    }).join('\n  ');
    cssVars['$radiusScale'] = radiusVars;
  }

  return cssVars;
}

function convertToTailwindV4(tokens) {
  const colors = convertToCSSVariables(tokens, 'tailwind_v4');

  // Generate OKLCH color scales
  const themeBlock = `
@theme {
  --color-primary: ${tokens.primaryColor || '#3b82f6'};
  --color-secondary: ${tokens.secondaryColor || '#64748b'};

  /* Typography */
  --font-sans: ${tokens.typography?.[0]?.fontFamily || 'system-ui, sans-serif'};

  /* Spacing */
  --spacing-base: 4px;

  /* Border Radius */
  --radius-sm: ${tokens.borderRadiusScale?.[0] || '4px'};
  --radius-md: ${tokens.borderRadiusScale?.[1] || '8px'};
  --radius-lg: ${tokens.borderRadiusScale?.[2] || '12px'};
}
`;

  return themeBlock;
}

function convertToShadcnUI(tokens) {
  const primary = tokens.primaryColor || '#3b82f6';
  const secondary = tokens.secondaryColor || '#64748b';

  const cssVars = `
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: ${hexToHSL(primary)};
  --secondary: ${hexToHSL(secondary)};
  --border: 214.3 31.8% 91.4%;
  --radius: 0.5rem;
}
`.trim();

  return cssVars;
}

function hexToHSL(hex) {
  // Simplified conversion
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function adapt(tokens, projectPath, options = {}) {
  const framework = detectFramework(projectPath);
  const { format = framework.includes('tailwind') ? 'tailwind_v4' : 'shadcn_ui' } = options;

  switch (format) {
    case 'tailwind_v4':
      return convertToTailwindV4(tokens);
    case 'shadcn_ui':
      return convertToShadcnUI(tokens);
    default:
      return convertToCSSVariables(tokens, framework);
  }
}

// CLI
if (require.main === module) {
  const tokensPath = process.argv[2];
  const projectPath = process.argv[3] || '.';

  if (!tokensPath) {
    console.error('Usage: node adapter.js <tokens-path> [project-path]');
    process.exit(1);
  }

  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
  const result = adapt(tokens.analysis || tokens, projectPath);
  console.log(result);
}

module.exports = { detectFramework, adapt, convertToTailwindV4, convertToShadcnUI };
