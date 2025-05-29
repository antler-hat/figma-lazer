// This plugin will allow users to quickly set layout properties

// Log the command to the console for debugging
console.log('Figma command:', figma.command);

const __html_input_dialog__ = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Input Value</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            background-color: var(--figma-color-bg);
            color: var(--figma-color-text);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            padding: 10px;
            box-sizing: border-box;
        }
        #prompt-title {
            font-size: 12px;
            margin-bottom: 8px;
            text-align: center;
        }
        #value-input {
            width: calc(100% - 20px); /* Full width minus padding */
            padding: 8px;
            border-radius: 4px;
            border: 1px solid var(--figma-color-border);
            background-color: var(--figma-color-bg-secondary);
            color: var(--figma-color-text);
            font-size: 13px;
            box-sizing: border-box;
        }
        #value-input:focus {
            outline: 2px solid var(--figma-color-bg-brand);
            outline-offset: 0px;
            border-color: var(--figma-color-bg-brand-tertiary);
        }
    </style>
</head>
<body>
    <div id="prompt-title">Set Value</div>
    <input type="text" id="value-input">
    <script>
        const inputField = document.getElementById('value-input');
        const promptTitle = document.getElementById('prompt-title');
        let currentPropertyType = '';

        inputField.focus();

        window.onmessage = (event) => {
            const message = event.data.pluginMessage;
            if (message && message.type === 'init-input-dialog') {
                promptTitle.textContent = message.title || 'Enter Value';
                currentPropertyType = message.propertyType;
                if (message.currentValue !== undefined && message.currentValue !== null) {
                    inputField.value = String(message.currentValue);
                    inputField.select();
                } else {
                    inputField.value = '';
                }
                inputField.focus();
            }
        };

        inputField.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                parent.postMessage({
                    pluginMessage: {
                        type: 'submit-value',
                        propertyType: currentPropertyType,
                        value: inputField.value
                    }
                }, '*');
            } else if (event.key === 'Escape') {
                event.preventDefault();
                parent.postMessage({ pluginMessage: { type: 'close-plugin' } }, '*');
            }
        });
    <\/script> 
</body>
</html>`;

// Helper function to parse color string (hex) to Figma RGB
function parseColor(colorString: string): RGB | null {
  if (!colorString) return null;
  let hex = colorString.trim();
  if (hex.startsWith('#')) {
    hex = hex.substring(1);
  }
  // Allow 3, 6 hex characters
  if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(hex)) {
    figma.notify("Invalid color format. Use #RRGGBB or RRGGBB.", { error: true });
    return null;
  }

  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  const bigint = parseInt(hex, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;

  return { r, g, b };
}

// Helper function to check if a node is a valid Auto Layout frame
function isValidAutoLayoutNode(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode | ComponentSetNode {
  return (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET') && node.layoutMode !== 'NONE';
}

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
let stashedPrimaryAxisAlignment: FrameNode['primaryAxisAlignItems'] = 'CENTER';
let stashedCounterAxisAlignment: FrameNode['counterAxisAlignItems'] = 'CENTER';

// Centralized UI message handler
figma.ui.onmessage = msg => {
  if (!msg || !msg.type) return;

  const selection = figma.currentPage.selection; // Common for many actions

  switch (msg.type) {
    case 'submit-value':
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
                if (!isNaN(num)) {
                  (node as FrameNode).paddingLeft = num;
                  (node as FrameNode).paddingRight = num;
                  (node as FrameNode).paddingTop = num;
                  (node as FrameNode).paddingBottom = num;
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
              if ('resize' in node) {
                const num = parseFloat(value);
                if (!isNaN(num) && num >= 0) {
                  if ('layoutSizingVertical' in node) (node as FrameNode).layoutSizingVertical = 'FIXED';
                  (node as FrameNode | RectangleNode).resize(node.width, num);
                  modifiedCount++;
                  notifyMessage = `Height set to ${num}`;
                } else {
                  figma.notify("Invalid height value.", { error: true });
                  figma.closePlugin();
                  return;
                }
              }
              break;
            case 'setWidth': // Width
              if ('resize' in node) {
                const num = parseFloat(value);
                if (!isNaN(num) && num >= 0) {
                  if ('layoutSizingHorizontal' in node) (node as FrameNode).layoutSizingHorizontal = 'FIXED';
                  (node as FrameNode | RectangleNode).resize(num, node.height);
                  modifiedCount++;
                  notifyMessage = `Width set to ${num}`;
                } else {
                  figma.notify("Invalid width value.", { error: true });
                  figma.closePlugin();
                  return;
                }
              }
              break;
            case 'setBorderRadius': // Border Radius
              if ('cornerRadius' in node) {
                const num = parseFloat(value);
                if (!isNaN(num) && num >= 0) {
                  (node as FrameNode | RectangleNode).cornerRadius = num;
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
                  const strokableNode = node as FrameNode | RectangleNode | EllipseNode | PolygonNode | StarNode | LineNode | VectorNode | TextNode | ComponentNode | InstanceNode | ComponentSetNode;
                  if (num > 0 && strokableNode.strokes.length === 0) {
                     strokableNode.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; // Add default black stroke if none
                  }
                  strokableNode.strokeWeight = num;
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
                  const strokableNode = node as FrameNode | RectangleNode | EllipseNode | PolygonNode | StarNode | LineNode | VectorNode | TextNode | ComponentNode | InstanceNode | ComponentSetNode;
                  // Replace first stroke or add new if none. For simplicity, doesn't handle figma.mixed or multiple strokes.
                  strokableNode.strokes = [{ type: 'SOLID', color: color }];
                  modifiedCount++;
                  notifyMessage = `Stroke Color set`;
                } else {
                  // parseColor already notifies for invalid format
                  figma.closePlugin();
                  return;
                }
              }
              break;
            case 'setFillColour': // Fill Color
              if ('fills' in node) {
                const color = parseColor(value);
                if (color) {
                  const fillableNode = node as SceneNode & { fills: readonly Paint[] | typeof figma.mixed };
                   fillableNode.fills = [{ type: 'SOLID', color: color }];
                  modifiedCount++;
                  notifyMessage = `Fill Color set`;
                } else {
                  // parseColor already notifies
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
          }
        } catch (e) {
          console.error(`Error applying ${propertyType}:`, e);
          figma.notify(`Error applying property: ${(e as Error).message}`, { error: true });
        }
      }

      if (modifiedCount > 0) {
        figma.notify(`${notifyMessage} for ${modifiedCount} layer(s).`);
      } else if (selection.length > 0) {
        // This case might be hit if no applicable layers were found after the initial check,
        // or if the property didn't exist on any selected item.
        // The command-specific handlers should ideally pre-filter this.
        figma.notify(`No applicable layers found for this operation.`, { timeout: 3000 });
      }
      figma.closePlugin();
      break;

    case 'close-plugin': // Generic close from any UI
      figma.closePlugin();
      break;

    // Messages from auto-alignment-control.html (for 'aa' command)
    case 'set-alignment':
      // This logic is specific to the 'aa' command's UI and state
      if (figma.command === 'aa') {
        const [uiPrimary, uiCounter] = alignmentMap[msg.index];
        for (const node of selection) {
          if (isValidAutoLayoutNode(node)) {
            let finalPrimaryAlign: FrameNode['primaryAxisAlignItems'];
            let finalCounterAlign: FrameNode['counterAxisAlignItems'];
            if (pluginIsDistributeModeActive) {
              finalPrimaryAlign = 'SPACE_BETWEEN';
              finalCounterAlign = uiCounter; // Assuming UI sends counter correctly for distribute
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
        sendCurrentStateToUIForAA(); // AA specific update
      }
      break;
    case 'toggle-distribution':
      // Specific to 'aa' command
      if (figma.command === 'aa') {
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
        sendCurrentStateToUIForAA(); // AA specific update
      }
      break;
    case 'get-initial-visibility': // Specific to 'aa' command
       if (figma.command === 'aa') {
         sendCurrentStateToUIForAA();
       }
      break;
    case 'set-stroke': // This was from 'aa' UI, but seems general
      // Let's keep its original logic for now, applying to current selection
      let appliedStrokeCount = 0;
      for (const node of selection) {
        if ('strokes' in node && 'strokeWeight' in node) {
          const strokeWeight = msg.value;
          const strokableNode = node as FrameNode | RectangleNode | EllipseNode | PolygonNode | StarNode | LineNode | VectorNode | TextNode | ComponentNode | InstanceNode | ComponentSetNode;
          if (strokeWeight > 0) {
            if (strokableNode.strokes.length === 0) {
              strokableNode.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
            }
            strokableNode.strokeWeight = strokeWeight;
          } else {
            strokableNode.strokeWeight = 0;
          }
          appliedStrokeCount++;
        }
      }
      if (appliedStrokeCount > 0) {
        figma.notify(`Stroke set to ${msg.value} for ${appliedStrokeCount} layer(s).`);
      }
      // No figma.closePlugin() here, as this message might come from a persistent UI like 'aa'
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
  let layoutMode: FrameNode['layoutMode'] | null = null;
  let currentFigmaPrimaryAlign: FrameNode['primaryAxisAlignItems'] | null = null;
  let currentFigmaCounterAlign: FrameNode['counterAxisAlignItems'] | null = null;
  let isDistributeActiveInFigma = false;

  if (hasValidSelection) {
    const autoLayoutNode = selection.find(isValidAutoLayoutNode) as FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
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


if (figma.command === 'aa') {
  figma.showUI(__html__, { width: 180, height: 180, themeColors: true });
  sendCurrentStateToUIForAA(); // Initial state for AA UI
  figma.on('selectionchange', () => {
    if (figma.command === 'aa') { // Only if AA is the active command context
        sendCurrentStateToUIForAA();
    }
  });
  // figma.ui.onmessage is now global
} else if (figma.command === 'setPadding') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify("Please select at least one layer.", { error: true });
    figma.closePlugin();
  } else {
    const applicableNode = selection.find(node => 'paddingLeft' in node) as FrameNode | undefined;
    if (!applicableNode) {
      figma.notify("Padding is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      figma.showUI(__html_input_dialog__, { width: 250, height: 100, title: "Set Padding" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setPadding', title: 'Set All Padding (e.g., 10)', currentValue: applicableNode.paddingLeft === applicableNode.paddingRight && applicableNode.paddingLeft === applicableNode.paddingTop && applicableNode.paddingLeft === applicableNode.paddingBottom ? applicableNode.paddingLeft : null });
    }
  }
} else if (figma.command === 'setHeight') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify("Please select at least one layer.", { error: true });
    figma.closePlugin();
  } else {
    const applicableNode = selection.find(node => 'resize' in node && 'height' in node) as (SceneNode & {resize: (width: number, height: number) => void, height: number}) | undefined;
    if (!applicableNode) {
      figma.notify("Height is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      figma.showUI(__html_input_dialog__, { width: 250, height: 100, title: "Set Height" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setHeight', title: 'Set Height (e.g., 100)', currentValue: applicableNode.height });
    }
  }
} else if (figma.command === 'setWidth') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify("Please select at least one layer.", { error: true });
    figma.closePlugin();
  } else {
    const applicableNode = selection.find(node => 'resize' in node && 'width' in node) as (SceneNode & {resize: (width: number, height: number) => void, width: number}) | undefined;
    if (!applicableNode) {
      figma.notify("Width is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      figma.showUI(__html_input_dialog__, { width: 250, height: 100, title: "Set Width" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setWidth', title: 'Set Width (e.g., 100)', currentValue: applicableNode.width });
    }
  }
} else if (figma.command === 'setBorderRadius') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify("Please select at least one layer.", { error: true });
    figma.closePlugin();
  } else {
    const applicableNode = selection.find(node => 'cornerRadius' in node) as (SceneNode & {cornerRadius: number | typeof figma.mixed}) | undefined;
    if (!applicableNode) {
      figma.notify("Border Radius is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      figma.showUI(__html_input_dialog__, { width: 250, height: 100, title: "Set Border Radius" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setBorderRadius', title: 'Set Border Radius (e.g., 8)', currentValue: applicableNode.cornerRadius !== figma.mixed ? applicableNode.cornerRadius : null });
    }
  }
} else if (figma.command === 'setStrokeWidth') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify("Please select at least one layer.", { error: true });
    figma.closePlugin();
  } else {
    const applicableNode = selection.find(node => 'strokeWeight' in node) as (SceneNode & {strokeWeight: number | typeof figma.mixed}) | undefined;
    if (!applicableNode) {
      figma.notify("Stroke Width is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      figma.showUI(__html_input_dialog__, { width: 250, height: 100, title: "Set Stroke Width" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setStrokeWidth', title: 'Set Stroke Width (e.g., 1)', currentValue: applicableNode.strokeWeight !== figma.mixed ? applicableNode.strokeWeight : null });
    }
  }
} else if (figma.command === 'setStrokeColour') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify("Please select at least one layer.", { error: true });
    figma.closePlugin();
  } else {
    const applicableNode = selection.find(node => 'strokes' in node && (node as any).strokes.length > 0 && (node as any).strokes[0].type === 'SOLID') as (SceneNode & {strokes: readonly Paint[]}) | undefined;
    let currentColorHex: string | null = null;
    if (applicableNode) {
        const solidPaint = applicableNode.strokes[0] as SolidPaint;
        if (solidPaint.color) {
            const r = Math.round(solidPaint.color.r * 255);
            const g = Math.round(solidPaint.color.g * 255);
            const b = Math.round(solidPaint.color.b * 255);
            currentColorHex = `${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        }
    }
    if (!selection.some(node => 'strokes' in node)) { // Simplified check
      figma.notify("Stroke Color is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      figma.showUI(__html_input_dialog__, { width: 250, height: 100, title: "Set Stroke Color" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setStrokeColour', title: 'Set Stroke Color (e.g., #FF0000)', currentValue: currentColorHex });
    }
  }
} else if (figma.command === 'setFillColour') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify("Please select at least one layer.", { error: true });
    figma.closePlugin();
  } else {
    const applicableNode = selection.find(node => 'fills' in node && (node as any).fills.length > 0 && (node as any).fills[0].type === 'SOLID') as (SceneNode & {fills: readonly Paint[]}) | undefined;
    let currentColorHex: string | null = null;
    if (applicableNode) {
        const solidPaint = applicableNode.fills[0] as SolidPaint;
        if (solidPaint.color) {
            const r = Math.round(solidPaint.color.r * 255);
            const g = Math.round(solidPaint.color.g * 255);
            const b = Math.round(solidPaint.color.b * 255);
            currentColorHex = `${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        }
    }
    if (!selection.some(node => 'fills' in node)) { // Simplified check
      figma.notify("Fill Color is not applicable to any selected layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      figma.showUI(__html_input_dialog__, { width: 250, height: 100, title: "Set Fill Color" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setFillColour', title: 'Set Fill Color (e.g., #00FF00)', currentValue: currentColorHex });
    }
  }
} else if (figma.command === 'setGap') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify("Please select at least one layer.", { error: true });
    figma.closePlugin();
  } else {
    const applicableNode = selection.find(isValidAutoLayoutNode) as FrameNode | undefined;
    if (!applicableNode) {
      figma.notify("Gap is not applicable to any selected Auto Layout layers.", { error: true, timeout: 3000 });
      figma.closePlugin();
    } else {
      figma.showUI(__html_input_dialog__, { width: 250, height: 100, title: "Set Gap" });
      figma.ui.postMessage({ type: 'init-input-dialog', propertyType: 'setGap', title: 'Set Gap (e.g., 8)', currentValue: applicableNode.itemSpacing });
    }
  }
} else if (figma.command === 's1' || figma.command === 's0') {
  const selection = figma.currentPage.selection;
  let S = selection.length;
  if (S === 0) {
    figma.notify('Please select at least one layer.', { error: true });
    figma.closePlugin();
  } else {
    let modifiedCount = 0;
    const strokeWeight = figma.command === 's1' ? 1 : 0;
    const commandName = `Set Stroke to ${strokeWeight}`;

    for (const node of selection) {
      if ('strokes' in node && 'strokeWeight' in node) {
        const strokableNode = node as FrameNode | RectangleNode | EllipseNode | PolygonNode | StarNode | LineNode | VectorNode | TextNode | ComponentNode | InstanceNode | ComponentSetNode;
        if (strokeWeight > 0) {
          if (strokableNode.strokes.length === 0) {
            strokableNode.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
          }
          strokableNode.strokeWeight = strokeWeight;
        } else {
          strokableNode.strokeWeight = 0;
        }
        modifiedCount++;
      }
    }

    if (modifiedCount > 0) {
      figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${modifiedCount === 1 ? '' : 's'}.`);
    } else {
      figma.notify(`No applicable layers found for "${commandName}".`, { timeout: 3000 });
    }
    figma.closePlugin();
  }
} else if (figma.command === 'fill1' || figma.command === 'fill0') {
  const selection = figma.currentPage.selection;
  let S = selection.length;
  if (S === 0) {
    figma.notify('Please select at least one layer.', { error: true });
    figma.closePlugin();
  } else {
    let modifiedCount = 0;
    const commandName = figma.command === 'fill1' ? 'Add Default Fill' : 'Remove All Fills';

    for (const node of selection) {
      if ('fills' in node) {
        const fillableNode = node as SceneNode & { fills: readonly Paint[] | typeof figma.mixed }; 
        if (figma.command === 'fill1') {
          fillableNode.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // Default white fill1
        } else { 
          fillableNode.fills = [];
        }
        modifiedCount++;
      }
    }

    if (modifiedCount > 0) {
      figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${modifiedCount === 1 ? '' : 's'}.`);
    } else {
      figma.notify(`No applicable layers found for "${commandName}".`, { timeout: 3000 });
    }
    figma.closePlugin();
  }
} else { // Fallback for existing direct commands not using the new input dialog
  const selection = figma.currentPage.selection;
  let S = selection.length; 

  // Check for selection unless it's a command that doesn't need it (like 'aa' or new input dialog commands)
  const commandsRequiringSelection = ['wh', 'hh', 'wf', 'hf', 'p0', 'p16', 'br8', 'br0', 'gap0', 'gap8', 'gap16'];
  if (S === 0 && commandsRequiringSelection.includes(figma.command)) { 
    figma.notify('Please select at least one layer.', { error: true });
    figma.closePlugin();
  } else if (figma.command === 'gap0' || figma.command === 'gap8' || figma.command === 'gap16') {
      let modifiedCount = 0;
      const gapValue = figma.command === 'gap0' ? 0 : figma.command === 'gap8' ? 8 : 16;
      const commandName = `Set Gap to ${gapValue}`;
  
      for (const node of selection) {
        if (isValidAutoLayoutNode(node)) {
          node.itemSpacing = gapValue;
          modifiedCount++;
        }
      }
  
      if (modifiedCount > 0) {
        figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${modifiedCount === 1 ? '' : 's'}.`);
      } else {
        figma.notify(`No applicable Auto Layout layers found for "${commandName}".`, { timeout: 3000 });
      }
      figma.closePlugin();
  } else if (commandsRequiringSelection.includes(figma.command) || ['wh', 'hh', 'wf', 'hf', 'p0', 'p16', 'br8', 'br0'].includes(figma.command) ) { 
    // Covers other existing direct commands
    let modifiedCount = 0;
    let commandName = '';

    for (const node of selection) {
      try {
        if (node.type === 'GROUP') {
          commandName = figma.command === 'wh' ? 'Width to Hug' : figma.command === 'hh' ? 'Height to Hug' : figma.command === 'wf' ? 'Width to Fill' : 'Height to Fill';
          if (figma.command === 'wh' || figma.command === 'hh') {
            figma.notify(`Group "${node.name}" naturally hugs its content.`, { timeout: 2000 });
            // modifiedCount++; // Not really a modification
          } else {
             figma.notify(`Fill/Fixed sizing is not directly applicable to Groups. Consider Frame with Auto Layout.`, { timeout: 3000 });
          }
        } else if (
          node.type === 'FRAME' ||
          node.type === 'COMPONENT' ||
          node.type === 'COMPONENT_SET' ||
          node.type === 'INSTANCE' ||
          node.type === 'TEXT' ||
          node.type === 'RECTANGLE' 
        ) {
          const operableNode = node as FrameNode | ComponentNode | ComponentSetNode | InstanceNode | TextNode | RectangleNode; 

          if (figma.command === 'wh') {
            commandName = 'Width to Hug';
            operableNode.layoutSizingHorizontal = 'HUG';
            modifiedCount++;
          } else if (figma.command === 'hh') {
            commandName = 'Height to Hug';
            operableNode.layoutSizingVertical = 'HUG';
            modifiedCount++;
          } else if (figma.command === 'wf') {
            commandName = 'Width to Fill';
            if (operableNode.parent && operableNode.parent.type === 'FRAME' && (operableNode.parent as FrameNode).layoutMode !== 'NONE') {
              operableNode.layoutSizingHorizontal = 'FILL';
              modifiedCount++;
            } else {
                 figma.notify(`"${operableNode.name}" cannot be set to Fill Width as its parent is not an Auto Layout frame.`, { timeout: 3000 });
            }
          } else if (figma.command === 'hf') {
            commandName = 'Height to Fill';
            if (operableNode.parent && operableNode.parent.type === 'FRAME' && (operableNode.parent as FrameNode).layoutMode !== 'NONE') {
              operableNode.layoutSizingVertical = 'FILL';
              modifiedCount++;
            } else {
                figma.notify(`"${operableNode.name}" cannot be set to Fill Height as its parent is not an Auto Layout frame.`, { timeout: 3000 });
            }
          } else if (figma.command === 'p0') {
            commandName = 'Set All Padding to 0';
            if ('paddingTop' in operableNode && 'paddingBottom' in operableNode && 'paddingLeft' in operableNode && 'paddingRight' in operableNode) {
              const paddedNode = operableNode as FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
              paddedNode.paddingTop = 0;
              paddedNode.paddingBottom = 0;
              paddedNode.paddingLeft = 0;
              paddedNode.paddingRight = 0;
              modifiedCount++;
            }
          } else if (figma.command === 'p16') {
            commandName = 'Set All Padding to 16';
            if ('paddingTop' in operableNode && 'paddingBottom' in operableNode && 'paddingLeft' in operableNode && 'paddingRight' in operableNode) {
              const paddedNode = operableNode as FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
              paddedNode.paddingTop = 16;
              paddedNode.paddingBottom = 16;
              paddedNode.paddingLeft = 16;
              paddedNode.paddingRight = 16;
              modifiedCount++;
            }
          } else if (figma.command === 'br8') {
            commandName = 'Set Border Radius to 8px';
            if ('cornerRadius' in operableNode) {
              (operableNode as any).cornerRadius = 8; // Cast to any for mixed type
              modifiedCount++;
            }
          } else if (figma.command === 'br0') {
            commandName = 'Set Border Radius to 0px';
            if ('cornerRadius' in operableNode) {
              (operableNode as any).cornerRadius = 0; // Cast to any for mixed type
              modifiedCount++;
            }
          }
        }
      } catch (e) {
        figma.notify(`Error applying to "${node.name}": ${(e as Error).message}`, { error: true, timeout: 3000 });
      }
    }

    if (modifiedCount > 0 && commandName) {
      const plural = modifiedCount === 1 ? '' : 's';
      figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${plural}.`);
    } else if (S > 0 && commandName !== '' && !commandsRequiringSelection.includes(figma.command)) {
      // Only notify "no applicable" if it wasn't a selection issue handled earlier
      // And if it's one of the commands that should have found applicable layers
      figma.notify(`No applicable layers found for "${commandName}".`, { timeout: 3000 });
    }
    figma.closePlugin();
  } else if (figma.command && !['aa', 'setPadding', 'setHeight', 'setWidth', 'setBorderRadius', 'setStrokeWidth', 'setStrokeColour', 'setFillColour', 'setGap', 's1', 's0', 'fill1', 'fill0', 'gap0', 'gap8', 'gap16', 'wh', 'hh', 'wf', 'hf', 'p0', 'p16', 'br8', 'br0'].includes(figma.command)) {
     // Unknown command that wasn't handled by any previous block
     console.log("Unknown command, closing plugin:", figma.command);
     figma.closePlugin();
  }
  // If figma.command is one of the new UI commands, or 'aa', plugin closure is handled by UI interaction or submit.
}
