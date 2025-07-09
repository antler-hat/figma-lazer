// This plugin will allow users to quickly set layout properties

// Log the command to the console for debugging
console.log('Figma command:', figma.command);

import inputDialogHtmlContent from './ui/input-dialog.html';
import autoAlignmentControlHtmlContent from './ui/auto-alignment-control.html';
import helpDialogHtmlContent from './ui/help-dialog.html';

// --- START TYPE ALIASES ---
type ApplicableNode = FrameNode | ComponentNode | ComponentSetNode | InstanceNode | TextNode | RectangleNode | EllipseNode | PolygonNode | StarNode | LineNode | VectorNode;
type SizableNode = FrameNode | ComponentNode | ComponentSetNode | InstanceNode | TextNode | RectangleNode; // Nodes that have layoutSizingHorizontal/Vertical
type StrokableNode = FrameNode | ComponentNode | ComponentSetNode | InstanceNode | TextNode | RectangleNode | EllipseNode | PolygonNode | StarNode | LineNode | VectorNode;
type FillableNode = FrameNode | ComponentNode | ComponentSetNode | InstanceNode | TextNode | RectangleNode | EllipseNode | PolygonNode | StarNode | LineNode | VectorNode; // Simplified, most visual nodes can have fills
type PaddingApplicableNode = FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
type CornerRadiusApplicableNode = FrameNode | RectangleNode | ComponentNode | InstanceNode | ComponentSetNode; // Common nodes with cornerRadius
type AutoLayoutNode = FrameNode | ComponentNode | InstanceNode | ComponentSetNode; // Nodes that can be Auto Layout frames
// --- END TYPE ALIASES ---

// Helper function to parse color string (hex or name) to Figma RGB

const colorNameToHex: { [key: string]: string } = {
  "white": "FFFFFF",
  "black": "000000",
  "red": "FF0000",
  "green": "00FF00",
  "blue": "0000FF",
  "yellow": "FFFF00",
  "cyan": "00FFFF",
  "magenta": "FF00FF",
  "silver": "C0C0C0",
  "gray": "808080",
  "grey": "808080",
  "maroon": "800000",
  "olive": "808000",
  "purple": "800080",
  "teal": "008080",
  "navy": "000080",
  "gold": "FFD700",
  "orange": "FFA500",
  "pink": "FFC0CB",
  "brown": "A52A2A",
  "beige": "F5F5DC",
  "ivory": "FFFFF0",
  "khaki": "F0E68C",
  "lavender": "E6E6FA",
  "lime": "00FF00", // Same as green
  "salmon": "FA8072",
  "skyblue": "87CEEB",
  "violet": "EE82EE",
  "transparent": "00000000" // Special case, though Figma handles opacity separately
};

function parseColor(colorString: string): RGB | null {
  if (!colorString) return null;
  let hex = colorString.trim().toLowerCase();

  // Check if it's a known color name
  if (colorNameToHex[hex]) {
    hex = colorNameToHex[hex];
  }

  if (hex.startsWith('#')) {
    hex = hex.substring(1);
  }

  // Allow 3, 4, 6, or 8 hex characters (for alpha)
  // For this function, we only care about RGB, alpha is handled by Figma's Paint object opacity
  if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{4}$|^[0-9A-Fa-f]{6}$|^[0-9A-Fa-f]{8}$/.test(hex)) {
    figma.notify("Invalid color format. Use a name, #RGB, #RRGGBB, or #AARRGGBB.", { error: true });
    return null;
  }

  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  } else if (hex.length === 4) { // #ARGB to #AARRGGBB, then take RRGGBB
    hex = hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]; // We ignore alpha here, Figma handles opacity separately
  } else if (hex.length === 8) { // AARRGGBB, take RRGGBB
    hex = hex.substring(2); // We ignore alpha here
  }
  // If hex.length is 6, it's already in RRGGBB format

  const bigint = parseInt(hex, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;

  return { r, g, b };
}

// Helper function to check if a node is a valid Auto Layout frame
function isValidAutoLayoutNode(node: SceneNode): node is AutoLayoutNode {
  return (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET') && node.layoutMode !== 'NONE';
}

// --- START HELPER FUNCTIONS FOR PREFILLING INPUTS ---

/**
 * Gets a common property value from a list of nodes.
 * - If only one applicable node is selected, its property value is returned (if not figma.mixed).
 * - If multiple applicable nodes are selected, checks if they all share the same value.
 * - Returns null if values differ, any value is figma.mixed, or no applicable nodes are found.
 */
function getCommonPropertyValue(
  nodes: readonly SceneNode[],
  propertyName: keyof SceneNode | 'itemSpacing' | 'paddingLeft' | 'paddingRight' | 'paddingTop' | 'paddingBottom' | 'cornerRadius' | 'strokeWeight' | 'width' | 'height' | 'fontSize' | 'letterSpacing', // Added fontSize and letterSpacing
  isApplicable: (node: SceneNode) => boolean
): any | null {
  const applicableNodes = nodes.filter(isApplicable);

  if (applicableNodes.length === 0) {
    return null;
  }

  const firstValue = (applicableNodes[0] as any)[propertyName];

  if (firstValue === figma.mixed) {
    return null;
  }

  if (applicableNodes.length === 1) {
    return firstValue;
  }

  for (let i = 1; i < applicableNodes.length; i++) {
    const currentValue = (applicableNodes[i] as any)[propertyName];
    if (currentValue === figma.mixed || currentValue !== firstValue) {
      return null;
    }
  }
  return firstValue;
}

/**
 * Gets a common padding value if all applicable nodes have uniform padding
 * and this uniform padding is the same across all nodes.
 */
function getCommonPaddingValue(nodes: readonly SceneNode[]): number | null {
  const applicableNodes = nodes.filter(
    (node): node is PaddingApplicableNode => // Use type guard with alias
      'paddingLeft' in node &&
      'paddingRight' in node &&
      'paddingTop' in node &&
      'paddingBottom' in node
  ); // No need for 'as' assertion here due to type guard

  if (applicableNodes.length === 0) {
    return null;
  }

  let commonPadding: number | null = null;

  for (let i = 0; i < applicableNodes.length; i++) {
    const node = applicableNodes[i];
    if (
      (node.paddingLeft as (number | typeof figma.mixed)) === figma.mixed ||
      (node.paddingRight as (number | typeof figma.mixed)) === figma.mixed ||
      (node.paddingTop as (number | typeof figma.mixed)) === figma.mixed ||
      (node.paddingBottom as (number | typeof figma.mixed)) === figma.mixed
    ) {
      return null; // Mixed padding on a node
    }

    // At this point, we know they are numbers, so direct comparison is fine.
    const isUniform =
      node.paddingLeft === node.paddingRight &&
      node.paddingLeft === node.paddingTop &&
      node.paddingLeft === node.paddingBottom;

    if (!isUniform) {
      return null; // Not uniform padding on this node
    }

    if (i === 0) {
      commonPadding = node.paddingLeft; // Set from the first node
    } else if (node.paddingLeft !== commonPadding) {
      return null; // Different uniform padding values across nodes
    }
  }
  return commonPadding; // Can be 0 or any other number
}

/**
 * Gets a common solid paint color hex string if the first solid paint
 * of all applicable nodes has the same color.
 */
function getCommonSolidPaintColorHex(
  nodes: readonly SceneNode[],
  paintProperty: 'fills' | 'strokes'
): string | null {
  const applicableNodes = nodes.filter(node => paintProperty in node) as (SceneNode & { [K in typeof paintProperty]: readonly Paint[] | typeof figma.mixed })[];

  if (applicableNodes.length === 0) {
    return null;
  }

  let commonColorHex: string | null = null;

  for (let i = 0; i < applicableNodes.length; i++) {
    const node = applicableNodes[i];
    const paints = node[paintProperty];

    if (paints === figma.mixed || !Array.isArray(paints) || paints.length === 0) {
      return null; // Mixed paints, no paints, or not an array
    }

    const firstSolidPaint = paints.find(p => p.type === 'SOLID' && p.visible !== false) as SolidPaint | undefined;

    if (!firstSolidPaint || !firstSolidPaint.color) {
      return null; // No solid paint or no color object
    }
    
    const { r, g, b } = firstSolidPaint.color;
    const rHex = Math.round(r * 255).toString(16).padStart(2, '0');
    const gHex = Math.round(g * 255).toString(16).padStart(2, '0');
    const bHex = Math.round(b * 255).toString(16).padStart(2, '0');
    const currentColorHex = `${rHex}${gHex}${bHex}`.toUpperCase();

    if (i === 0) {
      commonColorHex = currentColorHex;
    } else if (currentColorHex !== commonColorHex) {
      return null; // Different colors
    }
  }
  return commonColorHex;
}

/**
 * Gets a common letter spacing value string (e.g., "10px", "5%")
 * if all applicable text nodes have the same letter spacing.
 */
function getCommonLetterSpacingValue(nodes: readonly SceneNode[]): string | null {
  const applicableNodes = nodes.filter(
    (node): node is TextNode => node.type === 'TEXT' && 'letterSpacing' in node
  );

  if (applicableNodes.length === 0) {
    return null;
  }

  const firstNodeLetterSpacing = applicableNodes[0].letterSpacing;
  if (firstNodeLetterSpacing === figma.mixed) {
    return null;
  }

  const firstValueString = `${firstNodeLetterSpacing.value}${firstNodeLetterSpacing.unit === 'PIXELS' ? 'px' : '%'}`;

  if (applicableNodes.length === 1) {
    return firstValueString;
  }

  for (let i = 1; i < applicableNodes.length; i++) {
    const currentNodeLetterSpacing = applicableNodes[i].letterSpacing;
    if (
      currentNodeLetterSpacing === figma.mixed ||
      currentNodeLetterSpacing.value !== firstNodeLetterSpacing.value ||
      currentNodeLetterSpacing.unit !== firstNodeLetterSpacing.unit
    ) {
      return null;
    }
  }
  return firstValueString;
}

// Helper function to load all unique fonts for a set of text nodes
async function loadFontsForNodes(nodes: readonly TextNode[]): Promise<void> {
  const fontsToLoad: FontName[] = [];
  const loadedFontKeys = new Set<string>(); // To avoid loading the same font multiple times

  for (const node of nodes) {
    if (node.fontName === figma.mixed) {
      const len = node.characters.length;
      for (let i = 0; i < len; i++) {
        const font = node.getRangeFontName(i, i + 1) as FontName;
        const fontKey = JSON.stringify(font);
        if (!loadedFontKeys.has(fontKey)) {
          fontsToLoad.push(font);
          loadedFontKeys.add(fontKey);
        }
      }
    } else {
      const font = node.fontName as FontName;
      const fontKey = JSON.stringify(font);
      if (!loadedFontKeys.has(fontKey)) {
        fontsToLoad.push(font);
        loadedFontKeys.add(fontKey);
      }
    }
  }
  await Promise.all(fontsToLoad.map(font => figma.loadFontAsync(font)));
}


// --- END HELPER FUNCTIONS FOR PREFILLING INPUTS ---

// --- START NEW HELPER FUNCTION FOR PERCENTAGE SIZING ---
function calculateSizeFromPercentageString(
  node: SceneNode,
  targetProperty: 'width' | 'height',
  expression: string
): number | null {
  if (!node.parent || node.parent.type === 'PAGE' || !('width' in node.parent) || !('height' in node.parent)) {
    figma.notify("Selected layer needs a valid parent (e.g., Frame, Group) for percentage sizing.", { error: true, timeout: 3000 });
    return null;
  }

  const parentDimension = targetProperty === 'width' ? node.parent.width : node.parent.height;
  if (typeof parentDimension !== 'number') {
    // This might happen if parent's dimension is figma.mixed or somehow not a number, though less likely for width/height
    figma.notify("Parent dimension is not a valid number.", { error: true, timeout: 3000 });
    return null;
  }

  // Regex to parse: "50%", "50% - 10", "50% + 10.5", "50% * 2", "50% / 2"
  // It captures: 1: percentage, 2: (optional) operator, 3: (optional) operand
  const regex = /^(\d+(?:\.\d+)?)%\s*(?:([+\-*/])\s*(\d+(?:\.\d+)?))?$/;
  const match = expression.trim().match(regex);

  if (!match) {
    figma.notify("Invalid percentage format. Use e.g., '50%', '50% - 10', '25.5% + 5'.", { error: true, timeout: 3000 });
    return null;
  }

  const percentage = parseFloat(match[1]);
  const operator = match[2];
  const operand = match[3] ? parseFloat(match[3]) : undefined;

  if (isNaN(percentage) || (operand !== undefined && isNaN(operand))) {
    figma.notify("Invalid number in percentage expression.", { error: true, timeout: 3000 });
    return null;
  }

  let calculatedValue = (percentage / 100) * parentDimension;

  if (operator && operand !== undefined) {
    switch (operator) {
      case '+':
        calculatedValue += operand;
        break;
      case '-':
        calculatedValue -= operand;
        break;
      case '*':
        calculatedValue *= operand;
        break;
      case '/':
        if (operand === 0) {
          figma.notify("Cannot divide by zero in percentage expression.", { error: true, timeout: 3000 });
          return null;
        }
        calculatedValue /= operand;
        break;
      default:
        figma.notify("Invalid operator in percentage expression.", { error: true, timeout: 3000 });
        return null;
    }
  }

  if (calculatedValue < 0) {
    // figma.notify("Calculated size is negative, clamping to 0.", { timeout: 2000 });
    return 0; // Figma doesn't allow negative width/height, will error if we try to set.
  }

  return calculatedValue;
}
// --- END NEW HELPER FUNCTION FOR PERCENTAGE SIZING ---

// Mapping from UI index (0-8) to Figma alignment properties
// [primaryAxisAlignItems, counterAxisAlignItems]
// For a HORIZONTAL layout frame:
// primaryAxisAlignItems refers to X-axis (MIN=Left, CENTER=Center, MAX=Right)
// counterAxisAlignItems refers to Y-axis (MIN=Top, CENTER=Center, MAX=Bottom)
// For a VERTICAL layout frame:
// primaryAxisAlignItems refers to Y-axis (MIN=Top, CENTER=Center, MAX=Bottom)
// counterAxisAlignItems refers to X-axis (MIN=Left, CENTER=Center, MAX=Right)

type CommonAlignment = "MIN" | "CENTER" | "MAX";

const alignmentMap: { [key: number]: [CommonAlignment, CommonAlignment] } = {
  0: ['MIN', 'MIN'],    // Top Left in UI grid
  1: ['CENTER', 'MIN'], // Top Center in UI grid
  2: ['MAX', 'MIN'],    // Top Right in UI grid
  3: ['MIN', 'CENTER'],  // Middle Left in UI grid
  4: ['CENTER', 'CENTER'],// Middle Center in UI grid
  5: ['MAX', 'CENTER'],  // Middle Right in UI grid
  6: ['MIN', 'MAX'],    // Bottom Left in UI grid
  7: ['CENTER', 'MAX'], // Bottom Center in UI grid
  8: ['MAX', 'MAX']     // Bottom Right in UI grid
};

// Mapping from Figma alignment properties back to UI index
function getIndexFromAlignment(primary: FrameNode['primaryAxisAlignItems'], counter: FrameNode['counterAxisAlignItems'], layoutMode: FrameNode['layoutMode']): number {
  for (const key in alignmentMap) {
    const [mapPrimary, mapCounter] = alignmentMap[key];
    if (layoutMode === 'HORIZONTAL' || layoutMode === 'NONE') { // Treat NONE as HORIZONTAL for mapping back
      if (mapPrimary === primary && mapCounter === counter) {
        return parseInt(key, 10);
      }
    } else { // VERTICAL
      if (mapCounter === primary && mapPrimary === counter) { // Swapped for vertical
        return parseInt(key, 10);
      }
    }
  }
  return 4; // Default to center if no match
}

// Plugin state for 'aa' command
let pluginIsDistributeModeActive = false;
let stashedPrimaryAxisAlignment: AutoLayoutNode['primaryAxisAlignItems'] = 'CENTER'; // Use AutoLayoutNode
let stashedCounterAxisAlignment: AutoLayoutNode['counterAxisAlignItems'] = 'CENTER'; // Use AutoLayoutNode

// --- START UI MESSAGE SUB-HANDLER for submit-value ---
async function handleSubmitValue(msg: any, selection: readonly SceneNode[]) {
  let modifiedCount = 0;
  const value = msg.value;
  const propertyType = msg.propertyType;
  let notifyMessage = '';

  for (const node of selection) {
    try {
      switch (propertyType) {
        case 'setPadding': // Padding
          if ('paddingLeft' in node && 'paddingRight' in node && 'paddingTop' in node && 'paddingBottom' in node) {
            const num = parseFloat(value);
            if (!isNaN(num) && num >= 0) { // Added num >= 0 check from previous plan
              (node as PaddingApplicableNode).paddingLeft = num;
              (node as PaddingApplicableNode).paddingRight = num;
              (node as PaddingApplicableNode).paddingTop = num;
              (node as PaddingApplicableNode).paddingBottom = num;
              modifiedCount++;
              notifyMessage = `Padding set to ${num}`;
            } else {
              figma.notify("Invalid padding value.", { error: true });
              figma.closePlugin();
              return;
            }
          }
          break;
        case 'setHeight': // Height
          let handledHeightByHugFill = false;
          if (typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            if (lowerValue === 'hug') {
              if (node.type === 'TEXT') {
                const textNode = node as TextNode;
                const parentIsAutoLayout = textNode.parent && isValidAutoLayoutNode(textNode.parent as SceneNode);
                if (parentIsAutoLayout && 'layoutSizingVertical' in textNode) {
                  textNode.layoutSizingVertical = 'HUG';
                } else {
                  await loadFontsForNodes([textNode]);
                  textNode.textAutoResize = 'HEIGHT';
                }
                modifiedCount++;
                notifyMessage = `Height set to Hug Contents`;
                handledHeightByHugFill = true;
              } else if ('layoutSizingVertical' in node && (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET')) {
                (node as SizableNode).layoutSizingVertical = 'HUG'; // Use SizableNode
                modifiedCount++;
                notifyMessage = `Height set to Hug Contents`;
                handledHeightByHugFill = true;
              }
            } else if (lowerValue === 'fill') {
              if ('layoutSizingVertical' in node && (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET' || node.type === 'TEXT')) {
                const operableNode = node as FrameNode | ComponentNode | InstanceNode | ComponentSetNode | TextNode;
                if (operableNode.parent && isValidAutoLayoutNode(operableNode.parent as SceneNode)) {
                  operableNode.layoutSizingVertical = 'FILL';
                  modifiedCount++;
                  notifyMessage = `Height set to Fill Container`;
                  handledHeightByHugFill = true;
                } else {
                  figma.notify(`"${operableNode.name}" cannot be set to Fill Height as its parent is not an Auto Layout frame.`, { error: true, timeout: 3000 });
                  handledHeightByHugFill = true; // Mark as handled to prevent falling into numeric parsing
                }
              }
            }
          }

          if (!handledHeightByHugFill && 'resize' in node && 'height' in node) {
            let finalHeight: number | null = null;
            if (typeof value === 'string' && value.includes('%')) {
              finalHeight = calculateSizeFromPercentageString(node, 'height', value);
            } else {
              const num = parseFloat(value);
              if (!isNaN(num) && num >= 0) {
                finalHeight = num;
              }
            }

            if (finalHeight !== null && finalHeight >= 0) {
              if (node.type === 'TEXT') {
                const textNode = node as TextNode;
                await loadFontsForNodes([textNode]);
                textNode.textAutoResize = 'NONE';
              }
              if ('layoutSizingVertical' in node) (node as SizableNode).layoutSizingVertical = 'FIXED';
              
              const originalWidth = node.width;
              const originalHeight = node.height; // Current height before this specific change

              const hasLockedAspectRatio = 'targetAspectRatio' in node && (node as any).targetAspectRatio !== null;
              const isAutoResizeText = node.type === 'TEXT' && (node as TextNode).textAutoResize !== 'NONE';
              
              if (hasLockedAspectRatio && !isAutoResizeText) {
                if (originalHeight === 0) { 
                  // Cannot determine aspect ratio if original height is 0. Resize with original width.
                  (node as SceneNode & { resize: (width: number, height: number) => void }).resize(originalWidth, finalHeight);
                } else {
                  const aspectRatio = originalWidth / originalHeight;
                  const newWidth = finalHeight * aspectRatio;
                  (node as SceneNode & { resize: (width: number, height: number) => void }).resize(newWidth, finalHeight);
                }
                modifiedCount++;
                notifyMessage = `Height set to ${parseFloat(finalHeight.toFixed(2))} (aspect ratio maintained)`;
              } else {
                // If not locked or is auto-resize text, resize normally, preserving current width.
                (node as SceneNode & { resize: (width: number, height: number) => void }).resize(originalWidth, finalHeight);
                modifiedCount++;
                notifyMessage = `Height set to ${parseFloat(finalHeight.toFixed(2))}`;
              }
            } else { // finalHeight is null or negative
              // This means value was not 'hug', 'fill', a valid '%', or a valid number.
              figma.notify("Invalid height value.", { error: true });
              figma.closePlugin();
              return;
            }
          } else if (!handledHeightByHugFill && !('resize' in node && 'height' in node)) {
            if (typeof value === 'string' && (value.toLowerCase() === 'hug' || value.toLowerCase() === 'fill')) {
                figma.notify(`"${value}" is not applicable to "${node.name}".`, { error: true, timeout: 3000 });
            }
          }
          break;
        case 'setWidth': // Width
          let handledWidthByHugFill = false;
          if (typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            if (lowerValue === 'hug') {
              if (node.type === 'TEXT') {
                const textNode = node as TextNode;
                const parentIsAutoLayout = textNode.parent && isValidAutoLayoutNode(textNode.parent as SceneNode);
                if (parentIsAutoLayout && 'layoutSizingHorizontal' in textNode) {
                  textNode.layoutSizingHorizontal = 'HUG';
                } else {
                  await loadFontsForNodes([textNode]);
                  textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
                }
                modifiedCount++;
                notifyMessage = `Width set to Hug Contents`;
                handledWidthByHugFill = true;
              } else if ('layoutSizingHorizontal' in node && (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET')) {
                (node as SizableNode).layoutSizingHorizontal = 'HUG'; // Use SizableNode
                modifiedCount++;
                notifyMessage = `Width set to Hug Contents`;
                handledWidthByHugFill = true;
              }
            } else if (lowerValue === 'fill') {
              if ('layoutSizingHorizontal' in node && (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET' || node.type === 'TEXT')) {
                const operableNode = node as FrameNode | ComponentNode | InstanceNode | ComponentSetNode | TextNode;
                if (operableNode.parent && isValidAutoLayoutNode(operableNode.parent as SceneNode)) {
                  operableNode.layoutSizingHorizontal = 'FILL';
                  modifiedCount++;
                  notifyMessage = `Width set to Fill Container`;
                  handledWidthByHugFill = true;
                } else {
                  figma.notify(`"${operableNode.name}" cannot be set to Fill Width as its parent is not an Auto Layout frame.`, { error: true, timeout: 3000 });
                  handledWidthByHugFill = true; // Mark as handled
                }
              }
            }
          }

          if (!handledWidthByHugFill && 'resize' in node && 'width' in node) {
            let finalWidth: number | null = null;
            if (typeof value === 'string' && value.includes('%')) {
              finalWidth = calculateSizeFromPercentageString(node, 'width', value);
            } else {
              const num = parseFloat(value);
              if (!isNaN(num) && num >= 0) {
                finalWidth = num;
              }
            }

            if (finalWidth !== null && finalWidth >= 0) {
              if (node.type === 'TEXT') {
                const textNode = node as TextNode;
                await loadFontsForNodes([textNode]);
                textNode.textAutoResize = 'NONE';
              }
              if ('layoutSizingHorizontal' in node) (node as FrameNode | ComponentNode | InstanceNode | ComponentSetNode | TextNode).layoutSizingHorizontal = 'FIXED';
              
              const originalWidth = node.width; // Current width before this specific change
              const originalHeight = node.height;

              const hasLockedAspectRatio = 'targetAspectRatio' in node && (node as any).targetAspectRatio !== null;
              const isAutoResizeText = node.type === 'TEXT' && (node as TextNode).textAutoResize !== 'NONE';
              
              if (hasLockedAspectRatio && !isAutoResizeText) {
                if (originalWidth === 0) {
                  // Cannot determine aspect ratio if original width is 0. Resize with original height.
                  (node as SceneNode & { resize: (width: number, height: number) => void }).resize(finalWidth, originalHeight);
                } else {
                  const aspectRatio = originalHeight / originalWidth;
                  const newHeight = finalWidth * aspectRatio;
                  (node as SceneNode & { resize: (width: number, height: number) => void }).resize(finalWidth, newHeight);
                }
                modifiedCount++;
                notifyMessage = `Width set to ${parseFloat(finalWidth.toFixed(2))} (aspect ratio maintained)`;
              } else {
                // If not locked or is auto-resize text, resize normally, preserving current height.
                (node as SceneNode & { resize: (width: number, height: number) => void }).resize(finalWidth, originalHeight);
                modifiedCount++;
                notifyMessage = `Width set to ${parseFloat(finalWidth.toFixed(2))}`;
              }
            } else { // finalWidth is null or negative
              figma.notify("Invalid width value.", { error: true });
              figma.closePlugin();
              return;
            }
          } else if (!handledWidthByHugFill && !('resize' in node && 'width' in node)) {
             if (typeof value === 'string' && (value.toLowerCase() === 'hug' || value.toLowerCase() === 'fill')) {
                figma.notify(`"${value}" is not applicable to "${node.name}".`, { error: true, timeout: 3000 });
            }
          }
          break;
        case 'setBorderRadius': // Border Radius
          if ('cornerRadius' in node) {
            const num = parseFloat(value);
            if (!isNaN(num) && num >= 0) {
              (node as CornerRadiusApplicableNode).cornerRadius = num; // Use CornerRadiusApplicableNode
              modifiedCount++;
              notifyMessage = `Border Radius set to ${num}`;
            } else {
              figma.notify("Invalid border radius value.", { error: true });
              figma.closePlugin();
              return;
            }
          }
          break;
        case 'setStrokeWidth': // Stroke Width
          if ('strokeWeight' in node) {
            const num = parseFloat(value);
            if (!isNaN(num) && num >= 0) {
              const localStrokableNode = node as StrokableNode; // Use StrokableNode
              if (num > 0 && localStrokableNode.strokes.length === 0) {
                 localStrokableNode.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; // Add default black stroke if none
              }
              localStrokableNode.strokeWeight = num;
              modifiedCount++;
              notifyMessage = `Stroke Width set to ${num}`;
            } else {
              figma.notify("Invalid stroke width value.", { error: true });
              figma.closePlugin();
              return;
            }
          }
          break;
        case 'setStrokeColour': // Stroke Color
          if ('strokes' in node) {
            const color = parseColor(value);
            if (color) {
              const localStrokableNode = node as StrokableNode; // Use StrokableNode
              localStrokableNode.strokes = [{ type: 'SOLID', color: color }];
              modifiedCount++;
              notifyMessage = `Stroke Color set`;
            } else {
              figma.closePlugin();
              return;
            }
          }
          break;
        case 'setFillColour': // Fill Color
          if ('fills' in node) {
            const color = parseColor(value);
            if (color) {
              const localFillableNode = node as FillableNode; // Use FillableNode
               localFillableNode.fills = [{ type: 'SOLID', color: color }];
              modifiedCount++;
              notifyMessage = `Fill Color set`;
            } else {
              figma.closePlugin();
              return;
            }
          }
          break;
        case 'setGap': // Gap
          if (isValidAutoLayoutNode(node)) {
            const num = parseFloat(value);
            if (!isNaN(num) && num >= 0) {
              node.itemSpacing = num;
              modifiedCount++;
              notifyMessage = `Gap set to ${num}`;
            } else {
              figma.notify("Invalid gap value.", { error: true });
              figma.closePlugin();
              return;
            }
          }
          break;
        case 'setTextSize': // Font Size
          if (node.type === 'TEXT') {
            const num = parseFloat(value);
            if (!isNaN(num) && num > 0) {
              await loadFontsForNodes([node as TextNode]); 
              (node as TextNode).fontSize = num;
              modifiedCount++;
              notifyMessage = `Font Size set to ${num}`;
            } else {
              figma.notify("Invalid font size value. Must be a positive number.", { error: true });
              figma.closePlugin();
              return;
            }
          }
          break;
        case 'setTextLetterSpacing': // Letter Spacing
          if (node.type === 'TEXT') {
            const strValue = String(value).trim().toLowerCase();
            const match = strValue.match(/^(\-?\d+(?:\.\d+)?)(px|%)?$/);
            if (match) {
              const num = parseFloat(match[1]);
              const unit = match[2] === '%' ? 'PERCENT' : 'PIXELS';
              await loadFontsForNodes([node as TextNode]); 
              (node as TextNode).letterSpacing = { value: num, unit: unit as ('PIXELS' | 'PERCENT') };
              modifiedCount++;
              notifyMessage = `Letter Spacing set to ${num}${unit === 'PIXELS' ? 'px' : '%'}`;
            } else {
              figma.notify("Invalid letter spacing. Use e.g., '2px' or '5%'.", { error: true });
              figma.closePlugin();
              return;
            }
          }
          break;
      }
    } catch (e) {
      console.error(`Error applying ${propertyType}:`, e);
      figma.notify(`Error applying property: ${(e as Error).message}`, { error: true });
    }
  }

  if (modifiedCount > 0) {
    figma.notify(`${notifyMessage} for ${modifiedCount} layer(s).`);
  } else if (selection.length > 0) {
    figma.notify(`No applicable layers found for this operation.`, { timeout: 3000 });
  }
  figma.closePlugin();
}
// --- END UI MESSAGE SUB-HANDLER for submit-value ---

// --- START UI MESSAGE SUB-HANDLERS for Auto-Alignment (AA) ---
function handleSetAlignmentAA(msg: any, selection: readonly SceneNode[]) {
  if (figma.command !== 'setAutolayout') return;
  const [uiPrimary, uiCounter] = alignmentMap[msg.index];
  for (const node of selection) {
    if (isValidAutoLayoutNode(node)) {
      let finalPrimaryAlign: AutoLayoutNode['primaryAxisAlignItems'];
      let finalCounterAlign: AutoLayoutNode['counterAxisAlignItems'];
      if (pluginIsDistributeModeActive) {
        finalPrimaryAlign = 'SPACE_BETWEEN';
        finalCounterAlign = uiCounter; 
        stashedCounterAxisAlignment = finalCounterAlign;
      } else {
        if (node.layoutMode === 'VERTICAL') {
          finalPrimaryAlign = uiCounter;
          finalCounterAlign = uiPrimary;
        } else {
          finalPrimaryAlign = uiPrimary;
          finalCounterAlign = uiCounter;
        }
        stashedPrimaryAxisAlignment = finalPrimaryAlign;
        stashedCounterAxisAlignment = finalCounterAlign;
      }
      node.primaryAxisAlignItems = finalPrimaryAlign;
      node.counterAxisAlignItems = finalCounterAlign;
    }
  }
  sendCurrentStateToUIForAA();
}

function handleToggleDistributionAA(selection: readonly SceneNode[]) {
  if (figma.command !== 'setAutolayout') return;
  pluginIsDistributeModeActive = !pluginIsDistributeModeActive;
  for (const node of selection) {
    if (isValidAutoLayoutNode(node)) {
      if (pluginIsDistributeModeActive) {
        node.primaryAxisAlignItems = 'SPACE_BETWEEN';
        node.counterAxisAlignItems = stashedCounterAxisAlignment;
      } else {
        node.primaryAxisAlignItems = stashedPrimaryAxisAlignment;
        node.counterAxisAlignItems = stashedCounterAxisAlignment;
      }
    }
  }
  sendCurrentStateToUIForAA();
}

function handleGetInitialVisibilityAA() {
  if (figma.command === 'setAutolayout') {
    sendCurrentStateToUIForAA();
  }
}

function handleSetLayoutDirectionAA(msg: any, selection: readonly SceneNode[]) {
  if (figma.command !== 'setAutolayout') return;
  const direction = msg.direction as 'HORIZONTAL' | 'VERTICAL';
  if (direction) {
    let changedCount = 0;
    for (const node of selection) {
      if (isValidAutoLayoutNode(node) && node.children) {
        const childrenSizing: { id: string; h: 'FIXED' | 'HUG' | 'FILL'; v: 'FIXED' | 'HUG' | 'FILL' }[] = [];
        for (const child of node.children) {
          if ('layoutSizingHorizontal' in child && 'layoutSizingVertical' in child) {
            childrenSizing.push({
              id: child.id,
              h: (child as SizableNode).layoutSizingHorizontal,
              v: (child as SizableNode).layoutSizingVertical
            });
          }
        }
        node.layoutMode = direction;
        for (const child of node.children) {
          const originalSizing = childrenSizing.find(s => s.id === child.id);
          if (originalSizing && 'layoutSizingHorizontal' in child && 'layoutSizingVertical' in child) {
            (child as SizableNode).layoutSizingHorizontal = originalSizing.h;
            (child as SizableNode).layoutSizingVertical = originalSizing.v;
          }
        }
        changedCount++;
      }
    }
    if (changedCount > 0) {
      figma.notify(`Layout direction set to ${direction.toLowerCase()} for ${changedCount} layer(s).`);
    }
    sendCurrentStateToUIForAA();
  }
}

function handleSetStrokeFromUIAA(msg: any, selection: readonly SceneNode[]) {
  // This function is called from the AA UI, so no figma.command === 'aa' check needed here
  // if it's only ever called from there. If it could be called from elsewhere, the check might be useful.
  let appliedStrokeCount = 0;
  for (const node of selection) {
    if ('strokes' in node && 'strokeWeight' in node) {
      const strokeWeight = msg.value;
      const localStrokableNode = node as StrokableNode;
      if (strokeWeight > 0) {
        if (localStrokableNode.strokes.length === 0) {
          localStrokableNode.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
        }
        localStrokableNode.strokeWeight = strokeWeight;
      } else {
        localStrokableNode.strokeWeight = 0;
      }
      appliedStrokeCount++;
    }
  }
  if (appliedStrokeCount > 0) {
    figma.notify(`Stroke set to ${msg.value} for ${appliedStrokeCount} layer(s).`);
  }
  // No figma.closePlugin() here, as this message comes from a persistent UI (AA)
}
// --- END UI MESSAGE SUB-HANDLERS for Auto-Alignment (AA) ---


// Centralized UI message handler
figma.ui.onmessage = async msg => { // Made async
  if (!msg || !msg.type) return;

  const selection = figma.currentPage.selection; // Common for many actions

  switch (msg.type) {
    case 'submit-value':
      await handleSubmitValue(msg, selection);
      break;
    case 'close-plugin':
      figma.closePlugin();
      break;
    case 'set-alignment':
      handleSetAlignmentAA(msg, selection);
      break;
    case 'toggle-distribution':
      handleToggleDistributionAA(selection);
      break;
    case 'get-initial-visibility':
      handleGetInitialVisibilityAA();
      break;
    case 'set-layout-direction':
      handleSetLayoutDirectionAA(msg, selection);
      break;
    case 'set-stroke':
      handleSetStrokeFromUIAA(msg, selection);
      break;
    default:
      console.log('Unknown message type from UI:', msg.type);
      break;
  }
};

// This function is specifically for the 'aa' command's UI
function sendCurrentStateToUIForAA() {
  const selection = figma.currentPage.selection;
  const hasValidSelection = selection.some(isValidAutoLayoutNode);
  let layoutMode: AutoLayoutNode['layoutMode'] | null = null; // Use AutoLayoutNode
  let currentFigmaPrimaryAlign: AutoLayoutNode['primaryAxisAlignItems'] | null = null; // Use AutoLayoutNode
  let currentFigmaCounterAlign: AutoLayoutNode['counterAxisAlignItems'] | null = null; // Use AutoLayoutNode
  let isDistributeActiveInFigma = false;

  if (hasValidSelection) {
    const autoLayoutNode = selection.find(isValidAutoLayoutNode) as AutoLayoutNode; // Use AutoLayoutNode
    layoutMode = autoLayoutNode.layoutMode;
    currentFigmaPrimaryAlign = autoLayoutNode.primaryAxisAlignItems;
    currentFigmaCounterAlign = autoLayoutNode.counterAxisAlignItems;
    isDistributeActiveInFigma = currentFigmaPrimaryAlign === 'SPACE_BETWEEN';
    
    pluginIsDistributeModeActive = isDistributeActiveInFigma; // Update global state for 'aa'
    if (!isDistributeActiveInFigma) {
      stashedPrimaryAxisAlignment = currentFigmaPrimaryAlign;
      stashedCounterAxisAlignment = currentFigmaCounterAlign;
    } else {
      stashedCounterAxisAlignment = currentFigmaCounterAlign;
    }
  }

  figma.ui.postMessage({
    type: 'update-plugin-state',
    hasValidSelection,
    layoutMode,
    currentFigmaPrimaryAlign,
    currentFigmaCounterAlign,
    isDistributeActiveInFigma
  });
}

// --- START NEW COMMAND HANDLERS & DISPATCHER ---

// Helper to check selection and notify if empty for commands that require it
function ensureSelection(selection: readonly SceneNode[], commandName: string): boolean {
  if (selection.length === 0) {
    figma.notify(`Please select at least one layer for "${commandName}".`, { error: true });
    figma.closePlugin();
    return false;
  }
  return true;
}

async function handleWidthHug(selection: readonly SceneNode[]) {
  if (!ensureSelection(selection, 'Width to Hug')) return;
  let modifiedCount = 0;
  for (const node of selection) {
    const nodeNameSafe = node.name || 'Unnamed';
    const nodeTypeSafe = node.type || 'UnknownType';
    console.log(`W-HUG: Processing node: ${node.id}, Type: ${nodeTypeSafe}, Name: ${nodeNameSafe}`);

    if (node.type === 'GROUP') {
      console.log(`W-HUG: Node ${nodeNameSafe} is GROUP`);
      figma.notify(`Group "${nodeNameSafe}" naturally hugs its content.`, { timeout: 2000 });
    } else if (node.type === 'TEXT') {
      console.log(`W-HUG: Node ${nodeNameSafe} is TEXT`);
      const textNode = node as TextNode;
      const parentIsAutoLayout = textNode.parent && isValidAutoLayoutNode(textNode.parent as SceneNode);
      if (parentIsAutoLayout) {
        console.log(`W-HUG: Text node ${nodeNameSafe} has AutoLayout parent. Setting layoutSizingHorizontal.`);
        try {
          textNode.layoutSizingHorizontal = 'HUG';
          modifiedCount++;
        } catch (e) {
          console.error(`W-HUG: Error HUG Text (AL parent) ${nodeNameSafe}:`, e);
          figma.notify(`Error HUG Text (AL): ${nodeNameSafe} - ${(e as Error).message}`, { error: true });
        }
      } else {
        console.log(`W-HUG: Text node ${nodeNameSafe} does not have AutoLayout parent. Setting textAutoResize.`);
        let fontsLoaded = false;
        try {
          await loadFontsForNodes([textNode]);
          fontsLoaded = true;
          console.log(`W-HUG: Fonts loaded for ${nodeNameSafe}`);
        } catch (e) {
          console.error(`W-HUG: Error loading fonts for ${nodeNameSafe}:`, e);
          figma.notify(`Error loading fonts for ${nodeNameSafe}: ${(e as Error).message}`, { error: true });
        }
        if (fontsLoaded) {
          try {
            textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
            modifiedCount++;
            console.log(`W-HUG: textAutoResize set for ${nodeNameSafe}`);
          } catch (e) {
            console.error(`W-HUG: Error textAutoResize ${nodeNameSafe}:`, e);
            figma.notify(`Error auto-resize Text: ${nodeNameSafe} - ${(e as Error).message}`, { error: true });
          }
        }
      }
    } else if (isValidAutoLayoutNode(node)) {
      console.log(`W-HUG: Node ${nodeNameSafe} is Valid AutoLayout. Setting layoutSizingHorizontal.`);
      try {
        node.layoutSizingHorizontal = 'HUG';
        modifiedCount++;
      } catch (e) {
        console.error(`W-HUG: Error HUG AutoLayout ${nodeNameSafe}:`, e);
        figma.notify(`Error HUG AutoLayout: ${nodeNameSafe} - ${(e as Error).message}`, { error: true });
      }
    } else {
      console.log(`W-HUG: Node ${nodeNameSafe} (${nodeTypeSafe}) is OTHER type. Notifying as inapplicable.`);
      figma.notify(`Hug Contents (Width) is not applicable to "${nodeNameSafe}" (${nodeTypeSafe}). Requires Auto Layout frames or text layers.`, { timeout: 3500 });
    }
  }
  console.log(`W-HUG: Loop finished. Modified count: ${modifiedCount}`);
  if (modifiedCount > 0) figma.notify(`Width set to Hug for ${modifiedCount} layer(s).`);
  else if (selection.length > 0) figma.notify('No applicable layers found for "Width to Hug".', { timeout: 2000 });
  figma.closePlugin();
}

async function handleHeightHug(selection: readonly SceneNode[]) {
  if (!ensureSelection(selection, 'Height to Hug')) return;
  let modifiedCount = 0;
  for (const node of selection) {
    const nodeNameSafe = node.name || 'Unnamed';
    const nodeTypeSafe = node.type || 'UnknownType';
    console.log(`H-HUG: Processing node: ${node.id}, Type: ${nodeTypeSafe}, Name: ${nodeNameSafe}`);

    if (node.type === 'GROUP') {
      console.log(`H-HUG: Node ${nodeNameSafe} is GROUP`);
      figma.notify(`Group "${nodeNameSafe}" naturally hugs its content.`, { timeout: 2000 });
    } else if (node.type === 'TEXT') {
      console.log(`H-HUG: Node ${nodeNameSafe} is TEXT`);
      const textNode = node as TextNode;
      const parentIsAutoLayout = textNode.parent && isValidAutoLayoutNode(textNode.parent as SceneNode);
      if (parentIsAutoLayout) {
        console.log(`H-HUG: Text node ${nodeNameSafe} has AutoLayout parent. Setting layoutSizingVertical.`);
        try {
          textNode.layoutSizingVertical = 'HUG';
          modifiedCount++;
        } catch (e) {
          console.error(`H-HUG: Error HUG Text V (AL parent) ${nodeNameSafe}:`, e);
          figma.notify(`Error HUG Text V (AL): ${nodeNameSafe} - ${(e as Error).message}`, { error: true });
        }
      } else {
        console.log(`H-HUG: Text node ${nodeNameSafe} does not have AutoLayout parent. Setting textAutoResize.`);
        let fontsLoaded = false;
        try {
          await loadFontsForNodes([textNode]);
          fontsLoaded = true;
          console.log(`H-HUG: Fonts loaded for ${nodeNameSafe}`);
        } catch (e) {
          console.error(`H-HUG: Error loading fonts V for ${nodeNameSafe}:`, e);
          figma.notify(`Error loading fonts V for ${nodeNameSafe}: ${(e as Error).message}`, { error: true });
        }
        if (fontsLoaded) {
          try {
            textNode.textAutoResize = 'HEIGHT';
            modifiedCount++;
            console.log(`H-HUG: textAutoResize set for ${nodeNameSafe}`);
          } catch (e) {
            console.error(`H-HUG: Error textAutoResize V ${nodeNameSafe}:`, e);
            figma.notify(`Error auto-resize Text V: ${nodeNameSafe} - ${(e as Error).message}`, { error: true });
          }
        }
      }
    } else if (isValidAutoLayoutNode(node)) {
      console.log(`H-HUG: Node ${nodeNameSafe} is Valid AutoLayout. Setting layoutSizingVertical.`);
      try {
        node.layoutSizingVertical = 'HUG';
        modifiedCount++;
      } catch (e) {
        console.error(`H-HUG: Error HUG AutoLayout V ${nodeNameSafe}:`, e);
        figma.notify(`Error HUG AutoLayout V: ${nodeNameSafe} - ${(e as Error).message}`, { error: true });
      }
    } else {
      console.log(`H-HUG: Node ${nodeNameSafe} (${nodeTypeSafe}) is OTHER type. Notifying as inapplicable.`);
      figma.notify(`Hug Contents (Height) is not applicable to "${nodeNameSafe}" (${nodeTypeSafe}). Requires Auto Layout frames or text layers.`, { timeout: 3500 });
    }
  }
  console.log(`H-HUG: Loop finished. Modified count: ${modifiedCount}`);
  if (modifiedCount > 0) figma.notify(`Height set to Hug for ${modifiedCount} layer(s).`);
  else if (selection.length > 0) figma.notify('No applicable layers found for "Height to Hug".', { timeout: 2000 });
  figma.closePlugin();
}

function handleWidthFill(selection: readonly SceneNode[]) {
  if (!ensureSelection(selection, 'Width to Fill')) return;
  let modifiedCount = 0;
  for (const node of selection) {
    if (node.type === 'GROUP') {
       figma.notify(`Fill/Fixed sizing is not directly applicable to Groups. Consider Frame with Auto Layout.`, { timeout: 3000 });
    } else if ('layoutSizingHorizontal' in node) {
      const sizableNode = node as SizableNode;
      if (sizableNode.parent && isValidAutoLayoutNode(sizableNode.parent as SceneNode)) {
        sizableNode.layoutSizingHorizontal = 'FILL';
        modifiedCount++;
      } else {
        figma.notify(`"${sizableNode.name}" cannot be set to Fill Width as its parent is not an Auto Layout frame.`, { timeout: 3000 });
      }
    }
  }
  if (modifiedCount > 0) figma.notify(`Width set to Fill for ${modifiedCount} layer(s).`);
  else if (selection.length > 0) figma.notify('No applicable layers found for "Width to Fill".', { timeout: 2000});
  figma.closePlugin();
}

function handleHeightFill(selection: readonly SceneNode[]) {
  if (!ensureSelection(selection, 'Height to Fill')) return;
  let modifiedCount = 0;
  for (const node of selection) {
     if (node.type === 'GROUP') {
       figma.notify(`Fill/Fixed sizing is not directly applicable to Groups. Consider Frame with Auto Layout.`, { timeout: 3000 });
    } else if ('layoutSizingVertical' in node) {
      const sizableNode = node as SizableNode;
      if (sizableNode.parent && isValidAutoLayoutNode(sizableNode.parent as SceneNode)) {
        sizableNode.layoutSizingVertical = 'FILL';
        modifiedCount++;
      } else {
        figma.notify(`"${sizableNode.name}" cannot be set to Fill Height as its parent is not an Auto Layout frame.`, { timeout: 3000 });
      }
    }
  }
  if (modifiedCount > 0) figma.notify(`Height set to Fill for ${modifiedCount} layer(s).`);
  else if (selection.length > 0) figma.notify('No applicable layers found for "Height to Fill".', { timeout: 2000});
  figma.closePlugin();
}

function setPaddingForSelection(paddingValue: number, selection: readonly SceneNode[]) {
  if (!ensureSelection(selection, `Set Padding to ${paddingValue}`)) return;
  let modifiedCount = 0;
  for (const node of selection) {
    if ('paddingTop' in node && 'paddingBottom' in node && 'paddingLeft' in node && 'paddingRight' in node) {
      const paddedNode = node as PaddingApplicableNode;
      paddedNode.paddingTop = paddingValue;
      paddedNode.paddingBottom = paddingValue;
      paddedNode.paddingLeft = paddingValue;
      paddedNode.paddingRight = paddingValue;
      modifiedCount++;
    }
  }
  if (modifiedCount > 0) figma.notify(`Padding set to ${paddingValue} for ${modifiedCount} layer(s).`);
  else if (selection.length > 0) figma.notify(`No applicable layers found for "Set Padding to ${paddingValue}".`, { timeout: 2000});
  figma.closePlugin();
}

function setBorderRadiusForSelection(radius: number, selection: readonly SceneNode[]) {
  if (!ensureSelection(selection, `Set Border Radius to ${radius}`)) return;
  let modifiedCount = 0;
  for (const node of selection) {
    if ('cornerRadius' in node) {
      (node as CornerRadiusApplicableNode).cornerRadius = radius;
      modifiedCount++;
    }
  }
  if (modifiedCount > 0) figma.notify(`Border Radius set to ${radius} for ${modifiedCount} layer(s).`);
  else if (selection.length > 0) figma.notify(`No applicable layers found for "Set Border Radius to ${radius}".`, { timeout: 2000});
  figma.closePlugin();
}

function setStrokeWeightForSelection(weight: number, selection: readonly SceneNode[]) {
  if (!ensureSelection(selection, `Set Stroke to ${weight}`)) return;
  let modifiedCount = 0;
  for (const node of selection) {
    if ('strokes' in node && 'strokeWeight' in node) {
      const strokableNode = node as StrokableNode;
      if (weight > 0 && strokableNode.strokes.length === 0) {
        strokableNode.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; // Add default black stroke
      }
      strokableNode.strokeWeight = weight;
      modifiedCount++;
    }
  }
  if (modifiedCount > 0) figma.notify(`Stroke set to ${weight} for ${modifiedCount} layer(s).`);
  else if (selection.length > 0) figma.notify(`No applicable layers found for "Set Stroke to ${weight}".`, { timeout: 2000});
  figma.closePlugin();
}

function handleFillWhite(selection: readonly SceneNode[]) {
  if (!ensureSelection(selection, 'Fill White')) return;
  let modifiedCount = 0;
  for (const node of selection) {
    if ('fills' in node) {
      (node as FillableNode).fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // White fill
      modifiedCount++;
    }
  }
  if (modifiedCount > 0) figma.notify(`White fill added to ${modifiedCount} layer(s).`);
  else if (selection.length > 0) figma.notify('No applicable layers found for "Fill White".', { timeout: 2000});
  figma.closePlugin();
}

function handleFillBlack(selection: readonly SceneNode[]) {
  if (!ensureSelection(selection, 'Add Black Fill')) return;
  let modifiedCount = 0;
  for (const node of selection) {
    if ('fills' in node) {
      (node as FillableNode).fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; // Black fill
      modifiedCount++;
    }
  }
  if (modifiedCount > 0) figma.notify(`Black fill added to ${modifiedCount} layer(s).`);
  else if (selection.length > 0) figma.notify('No applicable layers found for "Add Black Fill".', { timeout: 2000});
  figma.closePlugin();
}

function handleFillRemoveAll(selection: readonly SceneNode[]) {
  if (!ensureSelection(selection, 'Remove All Fills')) return;
  let modifiedCount = 0;
  for (const node of selection) {
    if ('fills' in node) {
      (node as FillableNode).fills = [];
      modifiedCount++;
    }
  }
  if (modifiedCount > 0) figma.notify(`All fills removed from ${modifiedCount} layer(s).`);
  else if (selection.length > 0) figma.notify('No applicable layers found for "Remove All Fills".', { timeout: 2000});
  figma.closePlugin();
}

function setGapForSelection(gapValue: number, selection: readonly SceneNode[]) {
  if (!ensureSelection(selection, `Set Gap to ${gapValue}`)) return;
  let modifiedCount = 0;
  for (const node of selection) {
    if (isValidAutoLayoutNode(node)) {
      node.itemSpacing = gapValue;
      modifiedCount++;
    }
  }
  if (modifiedCount > 0) figma.notify(`Gap set to ${gapValue} for ${modifiedCount} layer(s).`);
  else if (selection.length > 0) figma.notify(`No applicable Auto Layout layers found for "Set Gap to ${gapValue}".`, { timeout: 2000});
  figma.closePlugin();
}

function setAutoLayoutDirection(direction: 'HORIZONTAL' | 'VERTICAL', selection: readonly SceneNode[]) {
  if (!ensureSelection(selection, `Set Auto Layout to ${direction.toLowerCase()}`)) return;
  let modifiedCount = 0;
  for (const node of selection) {
    if (isValidAutoLayoutNode(node) && node.children) {
       const childrenSizing: { id: string; h: 'FIXED' | 'HUG' | 'FILL'; v: 'FIXED' | 'HUG' | 'FILL' }[] = [];
        for (const child of node.children) {
          if ('layoutSizingHorizontal' in child && 'layoutSizingVertical' in child) {
            childrenSizing.push({
              id: child.id,
              h: (child as SizableNode).layoutSizingHorizontal,
              v: (child as SizableNode).layoutSizingVertical
            });
          }
        }
        node.layoutMode = direction;
        for (const child of node.children) {
          const originalSizing = childrenSizing.find(s => s.id === child.id);
          if (originalSizing && 'layoutSizingHorizontal' in child && 'layoutSizingVertical' in child) {
            (child as SizableNode).layoutSizingHorizontal = originalSizing.h;
            (child as SizableNode).layoutSizingVertical = originalSizing.v;
          }
        }
      modifiedCount++;
    }
  }
  if (modifiedCount > 0) figma.notify(`Auto Layout direction set to ${direction.toLowerCase()} for ${modifiedCount} layer(s).`);
  else if (selection.length > 0) figma.notify(`No applicable Auto Layout layers found.`, { timeout: 2000});
  figma.closePlugin();
}


const commandHandlers: { [key: string]: (selection: readonly SceneNode[]) => Promise<void> | void } = {
  'widthHug': handleWidthHug,
  'heightHug': handleHeightHug,
  'widthFill': handleWidthFill,
  'heightFill': handleHeightFill,
  'padding0': (sel) => setPaddingForSelection(0, sel),
  'padding16': (sel) => setPaddingForSelection(16, sel),
  'borderRadius0': (sel) => setBorderRadiusForSelection(0, sel),
  'borderRadius8': (sel) => setBorderRadiusForSelection(8, sel),
  'stroke0': (sel) => setStrokeWeightForSelection(0, sel),
  'stroke1': (sel) => setStrokeWeightForSelection(1, sel),
  'fill0': handleFillRemoveAll,
  'fillWhite': handleFillWhite,
  'fillBlack': handleFillBlack,
  'gap0': (sel) => setGapForSelection(0, sel),
  'gap8': (sel) => setGapForSelection(8, sel),
  'gap16': (sel) => setGapForSelection(16, sel),
  'aLayoutHorizontal': (sel) => setAutoLayoutDirection('HORIZONTAL', sel),
  'aLayoutVertical': (sel) => setAutoLayoutDirection('VERTICAL', sel),
};

// --- END NEW COMMAND HANDLERS & DISPATCHER ---

// --- START NEW figma.on('run') HANDLER ---
figma.on('run', async ({ command, parameters }: RunEvent) => {
  const selection = figma.currentPage.selection;

  // If parameters are provided, handle the command directly
  if (parameters) {
    const value = parameters.value;
    // We can create a simple mapping for commands that just need a value
    const parameterCommandMap: { [key: string]: string } = {
      'setPadding': 'setPadding',
      'setHeight': 'setHeight',
      'setWidth': 'setWidth',
      'setBorderRadius': 'setBorderRadius',
      'setStrokeWidth': 'setStrokeWidth',
      'setStrokeColour': 'setStrokeColour',
      'setFillColour': 'setFillColour',
      'setGap': 'setGap',
      'textSize': 'setTextSize',
      'lineSpacing': 'setTextLetterSpacing'
    };

    if (parameterCommandMap[command]) {
      // Directly call a modified version of handleSubmitValue
      // This avoids duplicating logic. We pass a "fake" message object.
      await handleSubmitValue({ type: 'submit-value', propertyType: parameterCommandMap[command], value: value }, selection);
    } else {
      // Fallback for any parameterized command not in the map
      figma.notify(`Command "${command}" with parameters is not handled yet.`, { error: true });
      figma.closePlugin();
    }
    return; // Important to exit after handling parameterized command
  }

  // --- If NO parameters are provided, run original logic (show UI, etc.) ---

  if (command === 'setAutolayout') {
    figma.showUI(autoAlignmentControlHtmlContent, { width: 180, height: 180, themeColors: true });
    sendCurrentStateToUIForAA(); // Initial state for AA UI
    figma.on('selectionchange', () => {
      if (figma.command === 'setAutolayout') {
        sendCurrentStateToUIForAA();
      }
    });
  } else if (command === 'help') {
    figma.showUI(helpDialogHtmlContent, { width: 800, height: 600, themeColors: true, title: "Lazer Commands" });
  } else if (commandHandlers[command]) {
    commandHandlers[command](selection);
  } else if (command === 'setPadding') {
    if (!ensureSelection(selection, 'Set Padding')) return;
    const isPaddingApplicable = (node: SceneNode): node is PaddingApplicableNode =>
      'paddingLeft' in node && 'paddingRight' in node && 'paddingTop' in node && 'paddingBottom' in node;
    if (!selection.some(isPaddingApplicable)) {
      figma.notify("Padding is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      const commonPadding = getCommonPaddingValue(selection);
      figma.showUI(inputDialogHtmlContent, { themeColors: true, width: 250, height: 100, title: "Set Padding" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setPadding', title: 'Set All Padding (e.g., 10 or 10+5)', currentValue: commonPadding });
    }
  } else if (command === 'setHeight') {
    if (!ensureSelection(selection, 'Set Height')) return;
    const isHeightApplicable = (node: SceneNode): node is SceneNode & { height: number, resize: Function } =>
      'resize' in node && 'height' in node && typeof (node as any).height === 'number';
    if (!selection.some(isHeightApplicable)) {
      figma.notify("Height is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      const commonHeight = getCommonPropertyValue(selection, 'height', isHeightApplicable);
      figma.showUI(inputDialogHtmlContent, { themeColors: true, width: 250, height: 100, title: "Set Height" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setHeight', title: 'Set Height (e.g., 100, 50%, 25% + 10)', currentValue: commonHeight });
    }
  } else if (command === 'setWidth') {
    if (!ensureSelection(selection, 'Set Width')) return;
    const isWidthApplicable = (node: SceneNode): node is SceneNode & { width: number, resize: Function } =>
      'resize' in node && 'width' in node && typeof (node as any).width === 'number';
    if (!selection.some(isWidthApplicable)) {
      figma.notify("Width is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      const commonWidth = getCommonPropertyValue(selection, 'width', isWidthApplicable);
      figma.showUI(inputDialogHtmlContent, { themeColors: true, width: 250, height: 100, title: "Set Width" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setWidth', title: 'Set Width (e.g., 100, 50%, 25% + 10)', currentValue: commonWidth });
    }
  } else if (command === 'setBorderRadius') {
    if (!ensureSelection(selection, 'Set Border Radius')) return;
    const isBorderRadiusApplicable = (node: SceneNode): node is CornerRadiusApplicableNode => 'cornerRadius' in node;
    if (!selection.some(isBorderRadiusApplicable)) {
      figma.notify("Border Radius is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      const commonBorderRadius = getCommonPropertyValue(selection, 'cornerRadius', isBorderRadiusApplicable);
      figma.showUI(inputDialogHtmlContent, { themeColors: true, width: 250, height: 100, title: "Set Border Radius" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setBorderRadius', title: 'Set Border Radius (e.g., 8 or 2*3)', currentValue: commonBorderRadius });
    }
  } else if (command === 'setStrokeWidth') {
    if (!ensureSelection(selection, 'Set Stroke Width')) return;
    const isStrokeWeightApplicable = (node: SceneNode): node is SceneNode & { strokeWeight: number | typeof figma.mixed } => 'strokeWeight' in node;
    if (!selection.some(isStrokeWeightApplicable)) {
      figma.notify("Stroke Width is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      const commonStrokeWeight = getCommonPropertyValue(selection, 'strokeWeight', isStrokeWeightApplicable);
      figma.showUI(inputDialogHtmlContent, { themeColors: true, width: 250, height: 100, title: "Set Stroke Width" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setStrokeWidth', title: 'Set Stroke Width (e.g., 1 or 1+1)', currentValue: commonStrokeWeight });
    }
  } else if (command === 'setStrokeColour') {
    if (!ensureSelection(selection, 'Set Stroke Colour')) return;
    const isStrokeColorApplicable = (node: SceneNode): node is SceneNode & { strokes: readonly Paint[] | typeof figma.mixed } => 'strokes' in node;
    if (!selection.some(isStrokeColorApplicable)) {
      figma.notify("Stroke Color is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      const commonStrokeColorHex = getCommonSolidPaintColorHex(selection, 'strokes');
      figma.showUI(inputDialogHtmlContent, { themeColors: true, width: 250, height: 100, title: "Set Stroke Color" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setStrokeColour', title: 'Set Stroke Color (e.g., #FF0000)', currentValue: commonStrokeColorHex });
    }
  } else if (command === 'setFillColour') {
    if (!ensureSelection(selection, 'Set Fill Colour')) return;
    const isFillColorApplicable = (node: SceneNode): node is SceneNode & { fills: readonly Paint[] | typeof figma.mixed } => 'fills' in node;
    if (!selection.some(isFillColorApplicable)) {
      figma.notify("Fill Color is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      const commonFillColorHex = getCommonSolidPaintColorHex(selection, 'fills');
      figma.showUI(inputDialogHtmlContent, { themeColors: true, width: 250, height: 100, title: "Set Fill Color" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setFillColour', title: 'Set Fill Color (e.g., #00FF00)', currentValue: commonFillColorHex });
    }
  } else if (command === 'setGap') {
    if (!ensureSelection(selection, 'Set Gap')) return;
    if (!selection.some(isValidAutoLayoutNode)) {
      figma.notify("Gap is not applicable to any selected Auto Layout layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      const commonGap = getCommonPropertyValue(selection, 'itemSpacing', isValidAutoLayoutNode);
      figma.showUI(inputDialogHtmlContent, { themeColors: true, width: 250, height: 100, title: "Set Gap" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setGap', title: 'Set Gap (e.g., 8 or 10-2)', currentValue: commonGap });
    }
  } else if (command === 'textSize') {
    if (!ensureSelection(selection, 'Set Text Size')) return;
    const isTextNode = (node: SceneNode): node is TextNode => node.type === 'TEXT' && 'fontSize' in node;
    const textNodes = selection.filter(isTextNode);
    if (textNodes.length === 0) {
      figma.notify("Font Size is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      const commonFontSize = getCommonPropertyValue(textNodes, 'fontSize', isTextNode);
      figma.showUI(inputDialogHtmlContent, { themeColors: true, width: 250, height: 100, title: "Set Font Size" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setTextSize', title: 'Set Font Size (e.g., 16)', currentValue: commonFontSize });
    }
  } else if (command === 'lineSpacing') {
    if (!ensureSelection(selection, 'Set Letter Spacing')) return;
    const isTextNodeWithLetterSpacing = (node: SceneNode): node is TextNode => node.type === 'TEXT' && 'letterSpacing' in node;
    const textNodes = selection.filter(isTextNodeWithLetterSpacing);
    if (textNodes.length === 0) {
      figma.notify("Letter Spacing is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      const commonLetterSpacing = getCommonLetterSpacingValue(textNodes);
      figma.showUI(inputDialogHtmlContent, { themeColors: true, width: 250, height: 100, title: "Set Letter Spacing" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setTextLetterSpacing', title: 'Set Letter Spacing (e.g., 2px or 5%)', currentValue: commonLetterSpacing });
    }
  } else if (command) {
    console.log("Unknown or unhandled command, closing plugin:", command);
    figma.notify(`Command "${command}" is not recognized or has no specific handler.`, { error: true, timeout: 3000 });
    figma.closePlugin();
  }
});
// --- END NEW figma.on('run') HANDLER ---
