"use strict";
(() => {
  // src/ui/input-dialog.html
  var input_dialog_default = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Input Value</title>
    <style>
        body {
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, SFProLocalRange;
            margin: 0;
            background-color: var(--figma-color-bg);
            color: var(--figma-color-text-secondary);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            padding: 10px;
            box-sizing: border-box;
            font-size: 11px;
        }

        #value-input {
            width: calc(100% - 20px); /* Full width minus padding */
            padding: 8px;
            border-radius: 5px;
            border: 1px solid var(--figma-color-border);
            background-color: var(--figma-color-bg-secondary);
            color: var(--figma-color-text-secondary);
            font-size: 11px;
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
    <input type="text" id="value-input">
    <script>
        const inputField = document.getElementById('value-input');
        let currentPropertyType = '';

        // Focus the input field when the UI is shown
        inputField.focus();

        window.onmessage = (event) => {
            const message = event.data.pluginMessage;
            if (message && message.type === 'init-input-dialog') {
                currentPropertyType = message.propertyType;
                if (message.currentValue !== undefined && message.currentValue !== null) {
                    inputField.value = String(message.currentValue);
                    inputField.select(); // Select the current value for easy replacement
                } else {
                    inputField.value = ''; // Clear if no current value
                }
                inputField.focus(); // Re-focus just in case
            }
        };

        const numericPropertyTypes = [
            'setPadding',
            'setHeight',
            'setWidth',
            'setBorderRadius',
            'setStrokeWidth',
            'setGap'
        ];

        function evaluateMathematicalExpression(expression) {
            if (typeof expression !== 'string') {
                return null;
            }
            // Sanitize the expression: allow numbers, decimal points, operators +, -, *, /, and parentheses.
            // Remove any other characters.
            const sanitizedExpression = expression.replace(/[^-()\\d/*+.]/g, '');

            // Check if the sanitized expression is empty or doesn't look like a valid start of an expression
            if (!sanitizedExpression || !/^[-\\d(]/.test(sanitizedExpression)) {
                 // if it doesn't contain any operator, it's not an expression we should evaluate
                if (!/[+\\-*/]/.test(expression)) return expression; // return original if no operators
                return null; // otherwise, it's likely an invalid attempt at an expression
            }

            try {
                // Using Function constructor for safer evaluation than eval()
                const result = new Function('return ' + sanitizedExpression)();
                if (typeof result === 'number' && isFinite(result)) {
                    return result;
                }
                return null; // Not a valid number or infinite
            } catch (error) {
                console.error('Error evaluating expression:', error);
                return null; // Evaluation failed
            }
        }

        inputField.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                let valueToSubmit = inputField.value.trim(); // Trim the input value upfront
                const lowerValue = valueToSubmit.toLowerCase(); // Use lowercase for "fill"/"hug" comparison

                if (currentPropertyType === 'setWidth' || currentPropertyType === 'setHeight') {
                    if (lowerValue === 'fill' || lowerValue === 'hug') {
                        valueToSubmit = lowerValue; // Submit "fill" or "hug"
                    } else if (valueToSubmit.includes('%')) {
                        // Percentage value, valueToSubmit is already correct (original trimmed input)
                    } else {
                        // Try to evaluate as a mathematical expression
                        const evaluatedValue = evaluateMathematicalExpression(valueToSubmit);
                        if (evaluatedValue !== null && typeof evaluatedValue === 'number') {
                            valueToSubmit = String(evaluatedValue);
                        }
                        // If not "fill", "hug", "%", or a valid math expression,
                        // valueToSubmit remains the original trimmed input.
                        // The backend (code.ts) will handle parsing this.
                    }
                } else if (numericPropertyTypes.includes(currentPropertyType)) {
                    // For other numeric types (e.g., padding, gap, border radius)
                    const evaluatedValue = evaluateMathematicalExpression(valueToSubmit);
                    if (evaluatedValue !== null && typeof evaluatedValue === 'number') {
                        valueToSubmit = String(evaluatedValue);
                    }
                    // If not a valid math expression, valueToSubmit remains the original trimmed input.
                }
                // For non-numeric types, or if no specific handling matched,
                // valueToSubmit is the original trimmed input.
                parent.postMessage({
                    pluginMessage: {
                        type: 'submit-value',
                        propertyType: currentPropertyType,
                        value: valueToSubmit
                    }
                }, '*');
            } else if (event.key === 'Escape') {
                event.preventDefault();
                parent.postMessage({ pluginMessage: { type: 'close-plugin' } }, '*');
            }
            // REVISED CODE BLOCK for ArrowUp/ArrowDown
            else if (numericPropertyTypes.includes(currentPropertyType) && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                event.preventDefault(); // Prevent default browser actions like cursor movement or page scroll

                const rawValue = inputField.value;
                let numericValue = parseFloat(rawValue); // Attempt direct parse

                // If direct parsing results in NaN, try evaluating as a mathematical expression
                if (isNaN(numericValue)) {
                    const evaluatedResult = evaluateMathematicalExpression(rawValue);
                    // Check if evaluation resulted in a valid, finite number
                    if (evaluatedResult !== null && typeof evaluatedResult === 'number' && isFinite(evaluatedResult)) {
                        numericValue = evaluatedResult;
                    }
                }

                // Only proceed with increment/decrement if we have a valid, finite number
                if (typeof numericValue === 'number' && isFinite(numericValue)) {
                    const step = event.shiftKey ? 10 : 1; // Determine step based on Shift key

                    if (event.key === 'ArrowUp') {
                        numericValue += step;
                    } else { // ArrowDown
                        numericValue -= step;
                    }
                    inputField.value = String(numericValue); // Update the input field

                    // Optional: select the text after changing it for easy further editing or submission
                    // inputField.select();
                }
                // If 'numericValue' is still not a valid number at this point (i.e., it's NaN),
                // no increment/decrement action is taken.
            }
            // END OF REVISED CODE BLOCK
        });

        // Optional: Close if user clicks outside the input/dialog area (might be tricky to implement robustly without more structure)
        // For now, Escape is the primary way to close without submitting.
    <\/script>
</body>
</html>
`;

  // src/code.ts
  console.log("Figma command:", figma.command);
  var colorNameToHex = {
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
    "lime": "00FF00",
    // Same as green
    "salmon": "FA8072",
    "skyblue": "87CEEB",
    "violet": "EE82EE",
    "transparent": "00000000"
    // Special case, though Figma handles opacity separately
  };
  function parseColor(colorString) {
    if (!colorString) return null;
    let hex = colorString.trim().toLowerCase();
    if (colorNameToHex[hex]) {
      hex = colorNameToHex[hex];
    }
    if (hex.startsWith("#")) {
      hex = hex.substring(1);
    }
    if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{4}$|^[0-9A-Fa-f]{6}$|^[0-9A-Fa-f]{8}$/.test(hex)) {
      figma.notify("Invalid color format. Use a name, #RGB, #RRGGBB, or #AARRGGBB.", { error: true });
      return null;
    }
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    } else if (hex.length === 4) {
      hex = hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    } else if (hex.length === 8) {
      hex = hex.substring(2);
    }
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16 & 255) / 255;
    const g = (bigint >> 8 & 255) / 255;
    const b = (bigint & 255) / 255;
    return { r, g, b };
  }
  function isValidAutoLayoutNode(node) {
    return (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE" || node.type === "COMPONENT_SET") && node.layoutMode !== "NONE";
  }
  function getCommonPropertyValue(nodes, propertyName, isApplicable) {
    const applicableNodes = nodes.filter(isApplicable);
    if (applicableNodes.length === 0) {
      return null;
    }
    const firstValue = applicableNodes[0][propertyName];
    if (firstValue === figma.mixed) {
      return null;
    }
    if (applicableNodes.length === 1) {
      return firstValue;
    }
    for (let i = 1; i < applicableNodes.length; i++) {
      const currentValue = applicableNodes[i][propertyName];
      if (currentValue === figma.mixed || currentValue !== firstValue) {
        return null;
      }
    }
    return firstValue;
  }
  function getCommonPaddingValue(nodes) {
    const applicableNodes = nodes.filter(
      (node) => (
        // Use type guard with alias
        "paddingLeft" in node && "paddingRight" in node && "paddingTop" in node && "paddingBottom" in node
      )
    );
    if (applicableNodes.length === 0) {
      return null;
    }
    let commonPadding = null;
    for (let i = 0; i < applicableNodes.length; i++) {
      const node = applicableNodes[i];
      if (node.paddingLeft === figma.mixed || node.paddingRight === figma.mixed || node.paddingTop === figma.mixed || node.paddingBottom === figma.mixed) {
        return null;
      }
      const isUniform = node.paddingLeft === node.paddingRight && node.paddingLeft === node.paddingTop && node.paddingLeft === node.paddingBottom;
      if (!isUniform) {
        return null;
      }
      if (i === 0) {
        commonPadding = node.paddingLeft;
      } else if (node.paddingLeft !== commonPadding) {
        return null;
      }
    }
    return commonPadding;
  }
  function getCommonSolidPaintColorHex(nodes, paintProperty) {
    const applicableNodes = nodes.filter((node) => paintProperty in node);
    if (applicableNodes.length === 0) {
      return null;
    }
    let commonColorHex = null;
    for (let i = 0; i < applicableNodes.length; i++) {
      const node = applicableNodes[i];
      const paints = node[paintProperty];
      if (paints === figma.mixed || !Array.isArray(paints) || paints.length === 0) {
        return null;
      }
      const firstSolidPaint = paints.find((p) => p.type === "SOLID" && p.visible !== false);
      if (!firstSolidPaint || !firstSolidPaint.color) {
        return null;
      }
      const { r, g, b } = firstSolidPaint.color;
      const rHex = Math.round(r * 255).toString(16).padStart(2, "0");
      const gHex = Math.round(g * 255).toString(16).padStart(2, "0");
      const bHex = Math.round(b * 255).toString(16).padStart(2, "0");
      const currentColorHex = `${rHex}${gHex}${bHex}`.toUpperCase();
      if (i === 0) {
        commonColorHex = currentColorHex;
      } else if (currentColorHex !== commonColorHex) {
        return null;
      }
    }
    return commonColorHex;
  }
  function getCommonLetterSpacingValue(nodes) {
    const applicableNodes = nodes.filter(
      (node) => node.type === "TEXT" && "letterSpacing" in node
    );
    if (applicableNodes.length === 0) {
      return null;
    }
    const firstNodeLetterSpacing = applicableNodes[0].letterSpacing;
    if (firstNodeLetterSpacing === figma.mixed) {
      return null;
    }
    const firstValueString = `${firstNodeLetterSpacing.value}${firstNodeLetterSpacing.unit === "PIXELS" ? "px" : "%"}`;
    if (applicableNodes.length === 1) {
      return firstValueString;
    }
    for (let i = 1; i < applicableNodes.length; i++) {
      const currentNodeLetterSpacing = applicableNodes[i].letterSpacing;
      if (currentNodeLetterSpacing === figma.mixed || currentNodeLetterSpacing.value !== firstNodeLetterSpacing.value || currentNodeLetterSpacing.unit !== firstNodeLetterSpacing.unit) {
        return null;
      }
    }
    return firstValueString;
  }
  async function loadFontsForNodes(nodes) {
    const fontsToLoad = [];
    const loadedFontKeys = /* @__PURE__ */ new Set();
    for (const node of nodes) {
      if (node.fontName === figma.mixed) {
        const len = node.characters.length;
        for (let i = 0; i < len; i++) {
          const font = node.getRangeFontName(i, i + 1);
          const fontKey = JSON.stringify(font);
          if (!loadedFontKeys.has(fontKey)) {
            fontsToLoad.push(font);
            loadedFontKeys.add(fontKey);
          }
        }
      } else {
        const font = node.fontName;
        const fontKey = JSON.stringify(font);
        if (!loadedFontKeys.has(fontKey)) {
          fontsToLoad.push(font);
          loadedFontKeys.add(fontKey);
        }
      }
    }
    await Promise.all(fontsToLoad.map((font) => figma.loadFontAsync(font)));
  }
  function calculateSizeFromPercentageString(node, targetProperty, expression) {
    if (!node.parent || node.parent.type === "PAGE" || !("width" in node.parent) || !("height" in node.parent)) {
      figma.notify("Selected layer needs a valid parent (e.g., Frame, Group) for percentage sizing.", { error: true, timeout: 3e3 });
      return null;
    }
    const parentDimension = targetProperty === "width" ? node.parent.width : node.parent.height;
    if (typeof parentDimension !== "number") {
      figma.notify("Parent dimension is not a valid number.", { error: true, timeout: 3e3 });
      return null;
    }
    const regex = /^(\d+(?:\.\d+)?)%\s*(?:([+\-*/])\s*(\d+(?:\.\d+)?))?$/;
    const match = expression.trim().match(regex);
    if (!match) {
      figma.notify("Invalid percentage format. Use e.g., '50%', '50% - 10', '25.5% + 5'.", { error: true, timeout: 3e3 });
      return null;
    }
    const percentage = parseFloat(match[1]);
    const operator = match[2];
    const operand = match[3] ? parseFloat(match[3]) : void 0;
    if (isNaN(percentage) || operand !== void 0 && isNaN(operand)) {
      figma.notify("Invalid number in percentage expression.", { error: true, timeout: 3e3 });
      return null;
    }
    let calculatedValue = percentage / 100 * parentDimension;
    if (operator && operand !== void 0) {
      switch (operator) {
        case "+":
          calculatedValue += operand;
          break;
        case "-":
          calculatedValue -= operand;
          break;
        case "*":
          calculatedValue *= operand;
          break;
        case "/":
          if (operand === 0) {
            figma.notify("Cannot divide by zero in percentage expression.", { error: true, timeout: 3e3 });
            return null;
          }
          calculatedValue /= operand;
          break;
        default:
          figma.notify("Invalid operator in percentage expression.", { error: true, timeout: 3e3 });
          return null;
      }
    }
    if (calculatedValue < 0) {
      return 0;
    }
    return calculatedValue;
  }
  var alignmentMap = {
    0: ["MIN", "MIN"],
    // Top Left in UI grid
    1: ["CENTER", "MIN"],
    // Top Center in UI grid
    2: ["MAX", "MIN"],
    // Top Right in UI grid
    3: ["MIN", "CENTER"],
    // Middle Left in UI grid
    4: ["CENTER", "CENTER"],
    // Middle Center in UI grid
    5: ["MAX", "CENTER"],
    // Middle Right in UI grid
    6: ["MIN", "MAX"],
    // Bottom Left in UI grid
    7: ["CENTER", "MAX"],
    // Bottom Center in UI grid
    8: ["MAX", "MAX"]
    // Bottom Right in UI grid
  };
  var pluginIsDistributeModeActive = false;
  var stashedPrimaryAxisAlignment = "CENTER";
  var stashedCounterAxisAlignment = "CENTER";
  async function handleSubmitValue(msg, selection) {
    let modifiedCount = 0;
    const value = msg.value;
    const propertyType = msg.propertyType;
    let notifyMessage = "";
    for (const node of selection) {
      try {
        switch (propertyType) {
          case "setPadding":
            if ("paddingLeft" in node && "paddingRight" in node && "paddingTop" in node && "paddingBottom" in node) {
              const num = parseFloat(value);
              if (!isNaN(num) && num >= 0) {
                node.paddingLeft = num;
                node.paddingRight = num;
                node.paddingTop = num;
                node.paddingBottom = num;
                modifiedCount++;
                notifyMessage = `Padding set to ${num}`;
              } else {
                figma.notify("Invalid padding value.", { error: true });
                figma.closePlugin();
                return;
              }
            }
            break;
          case "setHeight":
            let handledHeightByHugFill = false;
            if (typeof value === "string") {
              const lowerValue = value.toLowerCase();
              if (lowerValue === "hug") {
                if (node.type === "TEXT") {
                  const textNode = node;
                  const parentIsAutoLayout = textNode.parent && textNode.parent.type === "FRAME" && textNode.parent.layoutMode !== "NONE";
                  if (parentIsAutoLayout && "layoutSizingVertical" in textNode) {
                    textNode.layoutSizingVertical = "HUG";
                  } else {
                    await loadFontsForNodes([textNode]);
                    textNode.textAutoResize = "HEIGHT";
                  }
                  modifiedCount++;
                  notifyMessage = `Height set to Hug Contents`;
                  handledHeightByHugFill = true;
                } else if ("layoutSizingVertical" in node && (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE" || node.type === "COMPONENT_SET")) {
                  node.layoutSizingVertical = "HUG";
                  modifiedCount++;
                  notifyMessage = `Height set to Hug Contents`;
                  handledHeightByHugFill = true;
                }
              } else if (lowerValue === "fill") {
                if ("layoutSizingVertical" in node && (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE" || node.type === "COMPONENT_SET" || node.type === "TEXT")) {
                  const operableNode = node;
                  if (operableNode.parent && operableNode.parent.type === "FRAME" && operableNode.parent.layoutMode !== "NONE") {
                    operableNode.layoutSizingVertical = "FILL";
                    modifiedCount++;
                    notifyMessage = `Height set to Fill Container`;
                    handledHeightByHugFill = true;
                  } else {
                    figma.notify(`"${operableNode.name}" cannot be set to Fill Height as its parent is not an Auto Layout frame.`, { error: true, timeout: 3e3 });
                    handledHeightByHugFill = true;
                  }
                }
              }
            }
            if (!handledHeightByHugFill && "resize" in node && "height" in node) {
              let finalHeight = null;
              if (typeof value === "string" && value.includes("%")) {
                finalHeight = calculateSizeFromPercentageString(node, "height", value);
              } else {
                const num = parseFloat(value);
                if (!isNaN(num) && num >= 0) {
                  finalHeight = num;
                }
              }
              if (finalHeight !== null && finalHeight >= 0) {
                if ("layoutSizingVertical" in node) node.layoutSizingVertical = "FIXED";
                node.resize(node.width, finalHeight);
                modifiedCount++;
                notifyMessage = `Height set to ${parseFloat(finalHeight.toFixed(2))}`;
              } else {
                figma.notify("Invalid height value.", { error: true });
                figma.closePlugin();
                return;
              }
            } else if (!handledHeightByHugFill && !("resize" in node && "height" in node)) {
              if (typeof value === "string" && (value.toLowerCase() === "hug" || value.toLowerCase() === "fill")) {
                figma.notify(`"${value}" is not applicable to "${node.name}".`, { error: true, timeout: 3e3 });
              }
            }
            break;
          case "setWidth":
            let handledWidthByHugFill = false;
            if (typeof value === "string") {
              const lowerValue = value.toLowerCase();
              if (lowerValue === "hug") {
                if (node.type === "TEXT") {
                  const textNode = node;
                  const parentIsAutoLayout = textNode.parent && textNode.parent.type === "FRAME" && textNode.parent.layoutMode !== "NONE";
                  if (parentIsAutoLayout && "layoutSizingHorizontal" in textNode) {
                    textNode.layoutSizingHorizontal = "HUG";
                  } else {
                    await loadFontsForNodes([textNode]);
                    textNode.textAutoResize = "WIDTH_AND_HEIGHT";
                  }
                  modifiedCount++;
                  notifyMessage = `Width set to Hug Contents`;
                  handledWidthByHugFill = true;
                } else if ("layoutSizingHorizontal" in node && (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE" || node.type === "COMPONENT_SET")) {
                  node.layoutSizingHorizontal = "HUG";
                  modifiedCount++;
                  notifyMessage = `Width set to Hug Contents`;
                  handledWidthByHugFill = true;
                }
              } else if (lowerValue === "fill") {
                if ("layoutSizingHorizontal" in node && (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE" || node.type === "COMPONENT_SET" || node.type === "TEXT")) {
                  const operableNode = node;
                  if (operableNode.parent && operableNode.parent.type === "FRAME" && operableNode.parent.layoutMode !== "NONE") {
                    operableNode.layoutSizingHorizontal = "FILL";
                    modifiedCount++;
                    notifyMessage = `Width set to Fill Container`;
                    handledWidthByHugFill = true;
                  } else {
                    figma.notify(`"${operableNode.name}" cannot be set to Fill Width as its parent is not an Auto Layout frame.`, { error: true, timeout: 3e3 });
                    handledWidthByHugFill = true;
                  }
                }
              }
            }
            if (!handledWidthByHugFill && "resize" in node && "width" in node) {
              let finalWidth = null;
              if (typeof value === "string" && value.includes("%")) {
                finalWidth = calculateSizeFromPercentageString(node, "width", value);
              } else {
                const num = parseFloat(value);
                if (!isNaN(num) && num >= 0) {
                  finalWidth = num;
                }
              }
              if (finalWidth !== null && finalWidth >= 0) {
                if ("layoutSizingHorizontal" in node) node.layoutSizingHorizontal = "FIXED";
                node.resize(finalWidth, node.height);
                modifiedCount++;
                notifyMessage = `Width set to ${parseFloat(finalWidth.toFixed(2))}`;
              } else {
                figma.notify("Invalid width value.", { error: true });
                figma.closePlugin();
                return;
              }
            } else if (!handledWidthByHugFill && !("resize" in node && "width" in node)) {
              if (typeof value === "string" && (value.toLowerCase() === "hug" || value.toLowerCase() === "fill")) {
                figma.notify(`"${value}" is not applicable to "${node.name}".`, { error: true, timeout: 3e3 });
              }
            }
            break;
          case "setBorderRadius":
            if ("cornerRadius" in node) {
              const num = parseFloat(value);
              if (!isNaN(num) && num >= 0) {
                node.cornerRadius = num;
                modifiedCount++;
                notifyMessage = `Border Radius set to ${num}`;
              } else {
                figma.notify("Invalid border radius value.", { error: true });
                figma.closePlugin();
                return;
              }
            }
            break;
          case "setStrokeWidth":
            if ("strokeWeight" in node) {
              const num = parseFloat(value);
              if (!isNaN(num) && num >= 0) {
                const localStrokableNode = node;
                if (num > 0 && localStrokableNode.strokes.length === 0) {
                  localStrokableNode.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
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
          case "setStrokeColour":
            if ("strokes" in node) {
              const color = parseColor(value);
              if (color) {
                const localStrokableNode = node;
                localStrokableNode.strokes = [{ type: "SOLID", color }];
                modifiedCount++;
                notifyMessage = `Stroke Color set`;
              } else {
                figma.closePlugin();
                return;
              }
            }
            break;
          case "setFillColour":
            if ("fills" in node) {
              const color = parseColor(value);
              if (color) {
                const localFillableNode = node;
                localFillableNode.fills = [{ type: "SOLID", color }];
                modifiedCount++;
                notifyMessage = `Fill Color set`;
              } else {
                figma.closePlugin();
                return;
              }
            }
            break;
          case "setGap":
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
          case "setTextSize":
            if (node.type === "TEXT") {
              const num = parseFloat(value);
              if (!isNaN(num) && num > 0) {
                await loadFontsForNodes([node]);
                node.fontSize = num;
                modifiedCount++;
                notifyMessage = `Font Size set to ${num}`;
              } else {
                figma.notify("Invalid font size value. Must be a positive number.", { error: true });
                figma.closePlugin();
                return;
              }
            }
            break;
          case "setTextLetterSpacing":
            if (node.type === "TEXT") {
              const strValue = String(value).trim().toLowerCase();
              const match = strValue.match(/^(\-?\d+(?:\.\d+)?)(px|%)?$/);
              if (match) {
                const num = parseFloat(match[1]);
                const unit = match[2] === "%" ? "PERCENT" : "PIXELS";
                await loadFontsForNodes([node]);
                node.letterSpacing = { value: num, unit };
                modifiedCount++;
                notifyMessage = `Letter Spacing set to ${num}${unit === "PIXELS" ? "px" : "%"}`;
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
        figma.notify(`Error applying property: ${e.message}`, { error: true });
      }
    }
    if (modifiedCount > 0) {
      figma.notify(`${notifyMessage} for ${modifiedCount} layer(s).`);
    } else if (selection.length > 0) {
      figma.notify(`No applicable layers found for this operation.`, { timeout: 3e3 });
    }
    figma.closePlugin();
  }
  function handleSetAlignmentAA(msg, selection) {
    if (figma.command !== "aa") return;
    const [uiPrimary, uiCounter] = alignmentMap[msg.index];
    for (const node of selection) {
      if (isValidAutoLayoutNode(node)) {
        let finalPrimaryAlign;
        let finalCounterAlign;
        if (pluginIsDistributeModeActive) {
          finalPrimaryAlign = "SPACE_BETWEEN";
          finalCounterAlign = uiCounter;
          stashedCounterAxisAlignment = finalCounterAlign;
        } else {
          if (node.layoutMode === "VERTICAL") {
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
  function handleToggleDistributionAA(selection) {
    if (figma.command !== "aa") return;
    pluginIsDistributeModeActive = !pluginIsDistributeModeActive;
    for (const node of selection) {
      if (isValidAutoLayoutNode(node)) {
        if (pluginIsDistributeModeActive) {
          node.primaryAxisAlignItems = "SPACE_BETWEEN";
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
    if (figma.command === "aa") {
      sendCurrentStateToUIForAA();
    }
  }
  function handleSetLayoutDirectionAA(msg, selection) {
    if (figma.command !== "aa") return;
    const direction = msg.direction;
    if (direction) {
      let changedCount = 0;
      for (const node of selection) {
        if (isValidAutoLayoutNode(node) && node.children) {
          const childrenSizing = [];
          for (const child of node.children) {
            if ("layoutSizingHorizontal" in child && "layoutSizingVertical" in child) {
              childrenSizing.push({
                id: child.id,
                h: child.layoutSizingHorizontal,
                v: child.layoutSizingVertical
              });
            }
          }
          node.layoutMode = direction;
          for (const child of node.children) {
            const originalSizing = childrenSizing.find((s) => s.id === child.id);
            if (originalSizing && "layoutSizingHorizontal" in child && "layoutSizingVertical" in child) {
              child.layoutSizingHorizontal = originalSizing.h;
              child.layoutSizingVertical = originalSizing.v;
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
  function handleSetStrokeFromUIAA(msg, selection) {
    let appliedStrokeCount = 0;
    for (const node of selection) {
      if ("strokes" in node && "strokeWeight" in node) {
        const strokeWeight = msg.value;
        const localStrokableNode = node;
        if (strokeWeight > 0) {
          if (localStrokableNode.strokes.length === 0) {
            localStrokableNode.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
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
  }
  figma.ui.onmessage = async (msg) => {
    if (!msg || !msg.type) return;
    const selection = figma.currentPage.selection;
    switch (msg.type) {
      case "submit-value":
        await handleSubmitValue(msg, selection);
        break;
      case "close-plugin":
        figma.closePlugin();
        break;
      case "set-alignment":
        handleSetAlignmentAA(msg, selection);
        break;
      case "toggle-distribution":
        handleToggleDistributionAA(selection);
        break;
      case "get-initial-visibility":
        handleGetInitialVisibilityAA();
        break;
      case "set-layout-direction":
        handleSetLayoutDirectionAA(msg, selection);
        break;
      case "set-stroke":
        handleSetStrokeFromUIAA(msg, selection);
        break;
      default:
        console.log("Unknown message type from UI:", msg.type);
        break;
    }
  };
  function sendCurrentStateToUIForAA() {
    const selection = figma.currentPage.selection;
    const hasValidSelection = selection.some(isValidAutoLayoutNode);
    let layoutMode = null;
    let currentFigmaPrimaryAlign = null;
    let currentFigmaCounterAlign = null;
    let isDistributeActiveInFigma = false;
    if (hasValidSelection) {
      const autoLayoutNode = selection.find(isValidAutoLayoutNode);
      layoutMode = autoLayoutNode.layoutMode;
      currentFigmaPrimaryAlign = autoLayoutNode.primaryAxisAlignItems;
      currentFigmaCounterAlign = autoLayoutNode.counterAxisAlignItems;
      isDistributeActiveInFigma = currentFigmaPrimaryAlign === "SPACE_BETWEEN";
      pluginIsDistributeModeActive = isDistributeActiveInFigma;
      if (!isDistributeActiveInFigma) {
        stashedPrimaryAxisAlignment = currentFigmaPrimaryAlign;
        stashedCounterAxisAlignment = currentFigmaCounterAlign;
      } else {
        stashedCounterAxisAlignment = currentFigmaCounterAlign;
      }
    }
    figma.ui.postMessage({
      type: "update-plugin-state",
      hasValidSelection,
      layoutMode,
      currentFigmaPrimaryAlign,
      currentFigmaCounterAlign,
      isDistributeActiveInFigma
    });
  }
  function ensureSelection(selection, commandName) {
    if (selection.length === 0) {
      figma.notify(`Please select at least one layer for "${commandName}".`, { error: true });
      figma.closePlugin();
      return false;
    }
    return true;
  }
  async function handleWidthHug(selection) {
    if (!ensureSelection(selection, "Width to Hug")) return;
    let modifiedCount = 0;
    for (const node of selection) {
      if (node.type === "GROUP") {
        figma.notify(`Group "${node.name}" naturally hugs its content.`, { timeout: 2e3 });
      } else if ("layoutSizingHorizontal" in node) {
        const sizableNode = node;
        if (sizableNode.type === "TEXT") {
          const textNode = sizableNode;
          const parentIsAutoLayout = textNode.parent && textNode.parent.type === "FRAME" && textNode.parent.layoutMode !== "NONE";
          if (parentIsAutoLayout) {
            textNode.layoutSizingHorizontal = "HUG";
          } else {
            await loadFontsForNodes([textNode]);
            textNode.textAutoResize = "WIDTH_AND_HEIGHT";
          }
        } else {
          sizableNode.layoutSizingHorizontal = "HUG";
        }
        modifiedCount++;
      }
    }
    if (modifiedCount > 0) figma.notify(`Width set to Hug for ${modifiedCount} layer(s).`);
    else if (selection.length > 0) figma.notify('No applicable layers found for "Width to Hug".', { timeout: 2e3 });
    figma.closePlugin();
  }
  async function handleHeightHug(selection) {
    if (!ensureSelection(selection, "Height to Hug")) return;
    let modifiedCount = 0;
    for (const node of selection) {
      if (node.type === "GROUP") {
        figma.notify(`Group "${node.name}" naturally hugs its content.`, { timeout: 2e3 });
      } else if ("layoutSizingVertical" in node) {
        const sizableNode = node;
        if (sizableNode.type === "TEXT") {
          const textNode = sizableNode;
          const parentIsAutoLayout = textNode.parent && textNode.parent.type === "FRAME" && textNode.parent.layoutMode !== "NONE";
          if (parentIsAutoLayout) {
            textNode.layoutSizingVertical = "HUG";
          } else {
            await loadFontsForNodes([textNode]);
            textNode.textAutoResize = "HEIGHT";
          }
        } else {
          sizableNode.layoutSizingVertical = "HUG";
        }
        modifiedCount++;
      }
    }
    if (modifiedCount > 0) figma.notify(`Height set to Hug for ${modifiedCount} layer(s).`);
    else if (selection.length > 0) figma.notify('No applicable layers found for "Height to Hug".', { timeout: 2e3 });
    figma.closePlugin();
  }
  function handleWidthFill(selection) {
    if (!ensureSelection(selection, "Width to Fill")) return;
    let modifiedCount = 0;
    for (const node of selection) {
      if (node.type === "GROUP") {
        figma.notify(`Fill/Fixed sizing is not directly applicable to Groups. Consider Frame with Auto Layout.`, { timeout: 3e3 });
      } else if ("layoutSizingHorizontal" in node) {
        const sizableNode = node;
        if (sizableNode.parent && sizableNode.parent.type === "FRAME" && sizableNode.parent.layoutMode !== "NONE") {
          sizableNode.layoutSizingHorizontal = "FILL";
          modifiedCount++;
        } else {
          figma.notify(`"${sizableNode.name}" cannot be set to Fill Width as its parent is not an Auto Layout frame.`, { timeout: 3e3 });
        }
      }
    }
    if (modifiedCount > 0) figma.notify(`Width set to Fill for ${modifiedCount} layer(s).`);
    else if (selection.length > 0) figma.notify('No applicable layers found for "Width to Fill".', { timeout: 2e3 });
    figma.closePlugin();
  }
  function handleHeightFill(selection) {
    if (!ensureSelection(selection, "Height to Fill")) return;
    let modifiedCount = 0;
    for (const node of selection) {
      if (node.type === "GROUP") {
        figma.notify(`Fill/Fixed sizing is not directly applicable to Groups. Consider Frame with Auto Layout.`, { timeout: 3e3 });
      } else if ("layoutSizingVertical" in node) {
        const sizableNode = node;
        if (sizableNode.parent && sizableNode.parent.type === "FRAME" && sizableNode.parent.layoutMode !== "NONE") {
          sizableNode.layoutSizingVertical = "FILL";
          modifiedCount++;
        } else {
          figma.notify(`"${sizableNode.name}" cannot be set to Fill Height as its parent is not an Auto Layout frame.`, { timeout: 3e3 });
        }
      }
    }
    if (modifiedCount > 0) figma.notify(`Height set to Fill for ${modifiedCount} layer(s).`);
    else if (selection.length > 0) figma.notify('No applicable layers found for "Height to Fill".', { timeout: 2e3 });
    figma.closePlugin();
  }
  function setPaddingForSelection(paddingValue, selection) {
    if (!ensureSelection(selection, `Set Padding to ${paddingValue}`)) return;
    let modifiedCount = 0;
    for (const node of selection) {
      if ("paddingTop" in node && "paddingBottom" in node && "paddingLeft" in node && "paddingRight" in node) {
        const paddedNode = node;
        paddedNode.paddingTop = paddingValue;
        paddedNode.paddingBottom = paddingValue;
        paddedNode.paddingLeft = paddingValue;
        paddedNode.paddingRight = paddingValue;
        modifiedCount++;
      }
    }
    if (modifiedCount > 0) figma.notify(`Padding set to ${paddingValue} for ${modifiedCount} layer(s).`);
    else if (selection.length > 0) figma.notify(`No applicable layers found for "Set Padding to ${paddingValue}".`, { timeout: 2e3 });
    figma.closePlugin();
  }
  function setBorderRadiusForSelection(radius, selection) {
    if (!ensureSelection(selection, `Set Border Radius to ${radius}`)) return;
    let modifiedCount = 0;
    for (const node of selection) {
      if ("cornerRadius" in node) {
        node.cornerRadius = radius;
        modifiedCount++;
      }
    }
    if (modifiedCount > 0) figma.notify(`Border Radius set to ${radius} for ${modifiedCount} layer(s).`);
    else if (selection.length > 0) figma.notify(`No applicable layers found for "Set Border Radius to ${radius}".`, { timeout: 2e3 });
    figma.closePlugin();
  }
  function setStrokeWeightForSelection(weight, selection) {
    if (!ensureSelection(selection, `Set Stroke to ${weight}`)) return;
    let modifiedCount = 0;
    for (const node of selection) {
      if ("strokes" in node && "strokeWeight" in node) {
        const strokableNode = node;
        if (weight > 0 && strokableNode.strokes.length === 0) {
          strokableNode.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
        }
        strokableNode.strokeWeight = weight;
        modifiedCount++;
      }
    }
    if (modifiedCount > 0) figma.notify(`Stroke set to ${weight} for ${modifiedCount} layer(s).`);
    else if (selection.length > 0) figma.notify(`No applicable layers found for "Set Stroke to ${weight}".`, { timeout: 2e3 });
    figma.closePlugin();
  }
  function handleFillDefault(selection) {
    if (!ensureSelection(selection, "Add Default Fill")) return;
    let modifiedCount = 0;
    for (const node of selection) {
      if ("fills" in node) {
        node.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        modifiedCount++;
      }
    }
    if (modifiedCount > 0) figma.notify(`Default fill added to ${modifiedCount} layer(s).`);
    else if (selection.length > 0) figma.notify('No applicable layers found for "Add Default Fill".', { timeout: 2e3 });
    figma.closePlugin();
  }
  function handleFillRemoveAll(selection) {
    if (!ensureSelection(selection, "Remove All Fills")) return;
    let modifiedCount = 0;
    for (const node of selection) {
      if ("fills" in node) {
        node.fills = [];
        modifiedCount++;
      }
    }
    if (modifiedCount > 0) figma.notify(`All fills removed from ${modifiedCount} layer(s).`);
    else if (selection.length > 0) figma.notify('No applicable layers found for "Remove All Fills".', { timeout: 2e3 });
    figma.closePlugin();
  }
  function setGapForSelection(gapValue, selection) {
    if (!ensureSelection(selection, `Set Gap to ${gapValue}`)) return;
    let modifiedCount = 0;
    for (const node of selection) {
      if (isValidAutoLayoutNode(node)) {
        node.itemSpacing = gapValue;
        modifiedCount++;
      }
    }
    if (modifiedCount > 0) figma.notify(`Gap set to ${gapValue} for ${modifiedCount} layer(s).`);
    else if (selection.length > 0) figma.notify(`No applicable Auto Layout layers found for "Set Gap to ${gapValue}".`, { timeout: 2e3 });
    figma.closePlugin();
  }
  function setAutoLayoutDirection(direction, selection) {
    if (!ensureSelection(selection, `Set Auto Layout to ${direction.toLowerCase()}`)) return;
    let modifiedCount = 0;
    for (const node of selection) {
      if (isValidAutoLayoutNode(node) && node.children) {
        const childrenSizing = [];
        for (const child of node.children) {
          if ("layoutSizingHorizontal" in child && "layoutSizingVertical" in child) {
            childrenSizing.push({
              id: child.id,
              h: child.layoutSizingHorizontal,
              v: child.layoutSizingVertical
            });
          }
        }
        node.layoutMode = direction;
        for (const child of node.children) {
          const originalSizing = childrenSizing.find((s) => s.id === child.id);
          if (originalSizing && "layoutSizingHorizontal" in child && "layoutSizingVertical" in child) {
            child.layoutSizingHorizontal = originalSizing.h;
            child.layoutSizingVertical = originalSizing.v;
          }
        }
        modifiedCount++;
      }
    }
    if (modifiedCount > 0) figma.notify(`Auto Layout direction set to ${direction.toLowerCase()} for ${modifiedCount} layer(s).`);
    else if (selection.length > 0) figma.notify(`No applicable Auto Layout layers found.`, { timeout: 2e3 });
    figma.closePlugin();
  }
  var commandHandlers = {
    "wh": handleWidthHug,
    "hh": handleHeightHug,
    "wf": handleWidthFill,
    "hf": handleHeightFill,
    "p0": (sel) => setPaddingForSelection(0, sel),
    "p16": (sel) => setPaddingForSelection(16, sel),
    "br0": (sel) => setBorderRadiusForSelection(0, sel),
    "br8": (sel) => setBorderRadiusForSelection(8, sel),
    "s0": (sel) => setStrokeWeightForSelection(0, sel),
    "s1": (sel) => setStrokeWeightForSelection(1, sel),
    "fill0": handleFillRemoveAll,
    "fill1": handleFillDefault,
    "gap0": (sel) => setGapForSelection(0, sel),
    "gap8": (sel) => setGapForSelection(8, sel),
    "gap16": (sel) => setGapForSelection(16, sel),
    "aa.h": (sel) => setAutoLayoutDirection("HORIZONTAL", sel),
    "aa.v": (sel) => setAutoLayoutDirection("VERTICAL", sel)
  };
  async function handleTestAllCapabilities() {
    figma.notify("Starting All Capability Tests...", { timeout: 2e3 });
    console.log("--- Starting All Capability Tests ---");
    const testNodes = [];
    let testSucceeded = true;
    let testsRun = 0;
    let testsFailed = 0;
    async function runTest(name, testFn) {
      testsRun++;
      figma.notify(`Testing: ${name}...`, { timeout: 1e3 });
      console.log(`Testing: ${name}...`);
      try {
        await testFn();
        await new Promise((resolve) => setTimeout(resolve, 50));
        figma.notify(`SUCCESS: ${name}`, { timeout: 1500 });
        console.log(`SUCCESS: ${name}`);
      } catch (e) {
        testSucceeded = false;
        testsFailed++;
        figma.notify(`ERROR: ${name} - ${e.message}`, { error: true, timeout: 4e3 });
        console.error(`ERROR: ${name}`, e);
      }
    }
    await runTest("Create Test Nodes", () => {
      const page = figma.currentPage;
      const testFrame2 = figma.createFrame();
      testFrame2.name = "Test_Frame_Lazer";
      testFrame2.resize(200, 100);
      testFrame2.x = page.children.length * 250;
      page.appendChild(testFrame2);
      testNodes.push(testFrame2);
      const testText2 = figma.createText();
      testText2.name = "Test_Text_Lazer";
      testText2.characters = "Hello Lazer";
      testText2.fontSize = 24;
      testText2.x = testFrame2.x;
      testText2.y = testFrame2.y + 120;
      page.appendChild(testText2);
      testNodes.push(testText2);
      const testRect2 = figma.createRectangle();
      testRect2.name = "Test_Rect_Lazer";
      testRect2.resize(100, 50);
      testRect2.x = testFrame2.x;
      testRect2.y = testFrame2.y + 180;
      page.appendChild(testRect2);
      testNodes.push(testRect2);
      const testAutoLayoutFrame2 = figma.createFrame();
      testAutoLayoutFrame2.name = "Test_AutoLayout_Lazer";
      testAutoLayoutFrame2.layoutMode = "HORIZONTAL";
      testAutoLayoutFrame2.itemSpacing = 10;
      testAutoLayoutFrame2.paddingLeft = testAutoLayoutFrame2.paddingRight = testAutoLayoutFrame2.paddingTop = testAutoLayoutFrame2.paddingBottom = 5;
      testAutoLayoutFrame2.resize(300, 80);
      testAutoLayoutFrame2.x = testFrame2.x;
      testAutoLayoutFrame2.y = testFrame2.y + 250;
      const childRect1 = figma.createRectangle();
      childRect1.name = "Child1";
      childRect1.resize(50, 50);
      testAutoLayoutFrame2.appendChild(childRect1);
      const childRect2 = figma.createRectangle();
      childRect2.name = "Child2";
      childRect2.resize(50, 50);
      testAutoLayoutFrame2.appendChild(childRect2);
      page.appendChild(testAutoLayoutFrame2);
      testNodes.push(testAutoLayoutFrame2);
      figma.currentPage.selection = testNodes;
    });
    if (testNodes.length < 4) {
      figma.notify("Failed to create all test nodes. Aborting tests.", { error: true });
      figma.closePlugin();
      return;
    }
    const [testFrame, testText, testRect, testAutoLayoutFrame] = testNodes;
    await runTest("Width to Hug (Frame)", async () => handleWidthHug([testFrame]));
    await runTest("Height to Hug (Frame)", async () => handleHeightHug([testFrame]));
    testFrame.resize(200, 100);
    testFrame.layoutSizingHorizontal = "FIXED";
    testFrame.layoutSizingVertical = "FIXED";
    const fillTestParent = figma.createFrame();
    fillTestParent.name = "FillTestParent_Lazer";
    fillTestParent.layoutMode = "VERTICAL";
    fillTestParent.appendChild(testFrame);
    figma.currentPage.appendChild(fillTestParent);
    testNodes.push(fillTestParent);
    await runTest("Width to Fill (Frame)", async () => handleWidthFill([testFrame]));
    await runTest("Height to Fill (Frame)", async () => handleHeightFill([testFrame]));
    figma.currentPage.appendChild(testFrame);
    fillTestParent.remove();
    testNodes.pop();
    await runTest("Padding to 0 (AutoLayout)", async () => setPaddingForSelection(0, [testAutoLayoutFrame]));
    await runTest("Padding to 16 (AutoLayout)", async () => setPaddingForSelection(16, [testAutoLayoutFrame]));
    await runTest("Border Radius to 0 (Rect)", async () => setBorderRadiusForSelection(0, [testRect]));
    await runTest("Border Radius to 8 (Rect)", async () => setBorderRadiusForSelection(8, [testRect]));
    await runTest("Stroke to 0 (Rect)", async () => setStrokeWeightForSelection(0, [testRect]));
    await runTest("Stroke to 1 (Rect)", async () => setStrokeWeightForSelection(1, [testRect]));
    await runTest("Remove All Fills (Rect)", async () => handleFillRemoveAll([testRect]));
    await runTest("Add Default Fill (Rect)", async () => handleFillDefault([testRect]));
    await runTest("Gap to 0 (AutoLayout)", async () => setGapForSelection(0, [testAutoLayoutFrame]));
    await runTest("Gap to 8 (AutoLayout)", async () => setGapForSelection(8, [testAutoLayoutFrame]));
    await runTest("Gap to 16 (AutoLayout)", async () => setGapForSelection(16, [testAutoLayoutFrame]));
    await runTest("AutoLayout to Horizontal", async () => setAutoLayoutDirection("HORIZONTAL", [testAutoLayoutFrame]));
    await runTest("AutoLayout to Vertical", async () => setAutoLayoutDirection("VERTICAL", [testAutoLayoutFrame]));
    figma.currentPage.selection = [testAutoLayoutFrame];
    await runTest("Set Padding (UI Sim - 10)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setPadding", value: "10" }, [testAutoLayoutFrame]));
    figma.currentPage.selection = [testFrame];
    await runTest("Set Height (UI Sim - 150)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setHeight", value: "150" }, [testFrame]));
    await runTest("Set Width (UI Sim - 250)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setWidth", value: "250" }, [testFrame]));
    await runTest("Set Height (UI Sim - Hug)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setHeight", value: "hug" }, [testFrame]));
    await runTest("Set Width (UI Sim - Hug)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setWidth", value: "hug" }, [testFrame]));
    testFrame.resize(200, 100);
    testFrame.layoutSizingHorizontal = "FIXED";
    testFrame.layoutSizingVertical = "FIXED";
    const percentTestParent = figma.createFrame();
    percentTestParent.name = "PercentTestParent_Lazer";
    percentTestParent.resize(400, 300);
    percentTestParent.appendChild(testFrame);
    figma.currentPage.appendChild(percentTestParent);
    testNodes.push(percentTestParent);
    await runTest("Set Height (UI Sim - 50%)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setHeight", value: "50%" }, [testFrame]));
    await runTest("Set Width (UI Sim - 25% + 10)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setWidth", value: "25% + 10" }, [testFrame]));
    figma.currentPage.appendChild(testFrame);
    percentTestParent.remove();
    testNodes.pop();
    figma.currentPage.selection = [testRect];
    await runTest("Set Border Radius (UI Sim - 12)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setBorderRadius", value: "12" }, [testRect]));
    figma.currentPage.selection = [testRect];
    await runTest("Set Stroke Width (UI Sim - 3)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setStrokeWidth", value: "3" }, [testRect]));
    await runTest("Set Stroke Colour (UI Sim - #FF0000)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setStrokeColour", value: "#FF0000" }, [testRect]));
    figma.currentPage.selection = [testRect];
    await runTest("Set Fill Colour (UI Sim - #00FF00)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setFillColour", value: "#00FF00" }, [testRect]));
    figma.currentPage.selection = [testAutoLayoutFrame];
    await runTest("Set Gap (UI Sim - 20)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setGap", value: "20" }, [testAutoLayoutFrame]));
    figma.currentPage.selection = [testText];
    await loadFontsForNodes([testText]);
    await runTest("Set Text Size (UI Sim - 30)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setTextSize", value: "30" }, [testText]));
    await runTest("Set Text Letter Spacing (UI Sim - 2px)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setTextLetterSpacing", value: "2px" }, [testText]));
    await runTest("Set Text Letter Spacing (UI Sim - 5%)", async () => handleSubmitValue({ type: "submit-value", propertyType: "setTextLetterSpacing", value: "5%" }, [testText]));
    figma.currentPage.selection = [testAutoLayoutFrame];
    pluginIsDistributeModeActive = false;
    stashedPrimaryAxisAlignment = "CENTER";
    stashedCounterAxisAlignment = "CENTER";
    await runTest("AA: Set Alignment (Top-Left)", async () => handleSetAlignmentAA({ type: "set-alignment", index: 0 }, [testAutoLayoutFrame]));
    await runTest("AA: Set Alignment (Middle-Center)", async () => handleSetAlignmentAA({ type: "set-alignment", index: 4 }, [testAutoLayoutFrame]));
    await runTest("AA: Toggle Distribution (ON)", async () => handleToggleDistributionAA([testAutoLayoutFrame]));
    await runTest("AA: Set Alignment (Center-Right while Distribute)", async () => handleSetAlignmentAA({ type: "set-alignment", index: 5 }, [testAutoLayoutFrame]));
    await runTest("AA: Toggle Distribution (OFF)", async () => handleToggleDistributionAA([testAutoLayoutFrame]));
    await runTest("AA: Set Layout Direction (VERTICAL)", async () => handleSetLayoutDirectionAA({ type: "set-layout-direction", direction: "VERTICAL" }, [testAutoLayoutFrame]));
    await runTest("AA: Set Layout Direction (HORIZONTAL)", async () => handleSetLayoutDirectionAA({ type: "set-layout-direction", direction: "HORIZONTAL" }, [testAutoLayoutFrame]));
    await runTest("AA: Set Stroke (UI Sim - 2)", async () => handleSetStrokeFromUIAA({ type: "set-stroke", value: 2 }, [testAutoLayoutFrame]));
    if (testSucceeded) {
      figma.notify(`All ${testsRun} capability tests passed!`, { timeout: 5e3 });
      console.log(`--- All ${testsRun} capability tests passed! ---`);
    } else {
      figma.notify(`${testsFailed} out of ${testsRun} tests FAILED. Check console for details.`, { error: true, timeout: 8e3 });
      console.error(`--- ${testsFailed} out of ${testsRun} tests FAILED. ---`);
    }
    figma.closePlugin();
  }
  if (figma.command === "aa") {
    figma.showUI(__html__, { width: 180, height: 180, themeColors: true });
    sendCurrentStateToUIForAA();
    figma.on("selectionchange", () => {
      if (figma.command === "aa") {
        sendCurrentStateToUIForAA();
      }
    });
  } else if (commandHandlers[figma.command]) {
    const selection = figma.currentPage.selection;
    commandHandlers[figma.command](selection);
  } else if (figma.command === "internalTestAllCapabilities") {
    handleTestAllCapabilities();
  } else if (figma.command === "setPadding") {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Please select at least one layer.", { error: true });
      figma.closePlugin();
    } else {
      const isPaddingApplicable = (node) => "paddingLeft" in node && "paddingRight" in node && "paddingTop" in node && "paddingBottom" in node;
      if (!selection.some(isPaddingApplicable)) {
        figma.notify("Padding is not applicable to any selected layers.", { error: true, timeout: 3e3 });
        figma.closePlugin();
      } else {
        const commonPadding = getCommonPaddingValue(selection);
        figma.showUI(input_dialog_default, { themeColors: true, width: 250, height: 100, title: "Set Padding" });
        figma.ui.postMessage({ type: "init-input-dialog", propertyType: "setPadding", title: "Set All Padding (e.g., 10 or 10+5)", currentValue: commonPadding });
      }
    }
  } else if (figma.command === "setHeight") {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Please select at least one layer.", { error: true });
      figma.closePlugin();
    } else {
      const isHeightApplicable = (node) => "resize" in node && "height" in node && typeof node.height === "number";
      if (!selection.some(isHeightApplicable)) {
        figma.notify("Height is not applicable to any selected layers.", { error: true, timeout: 3e3 });
        figma.closePlugin();
      } else {
        const commonHeight = getCommonPropertyValue(selection, "height", isHeightApplicable);
        figma.showUI(input_dialog_default, { themeColors: true, width: 250, height: 100, title: "Set Height" });
        figma.ui.postMessage({ type: "init-input-dialog", propertyType: "setHeight", title: "Set Height (e.g., 100, 50%, 25% + 10)", currentValue: commonHeight });
      }
    }
  } else if (figma.command === "setWidth") {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Please select at least one layer.", { error: true });
      figma.closePlugin();
    } else {
      const isWidthApplicable = (node) => "resize" in node && "width" in node && typeof node.width === "number";
      if (!selection.some(isWidthApplicable)) {
        figma.notify("Width is not applicable to any selected layers.", { error: true, timeout: 3e3 });
        figma.closePlugin();
      } else {
        const commonWidth = getCommonPropertyValue(selection, "width", isWidthApplicable);
        figma.showUI(input_dialog_default, { themeColors: true, width: 250, height: 100, title: "Set Width" });
        figma.ui.postMessage({ type: "init-input-dialog", propertyType: "setWidth", title: "Set Width (e.g., 100, 50%, 25% + 10)", currentValue: commonWidth });
      }
    }
  } else if (figma.command === "setBorderRadius") {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Please select at least one layer.", { error: true });
      figma.closePlugin();
    } else {
      const isBorderRadiusApplicable = (node) => "cornerRadius" in node;
      if (!selection.some(isBorderRadiusApplicable)) {
        figma.notify("Border Radius is not applicable to any selected layers.", { error: true, timeout: 3e3 });
        figma.closePlugin();
      } else {
        const commonBorderRadius = getCommonPropertyValue(selection, "cornerRadius", isBorderRadiusApplicable);
        figma.showUI(input_dialog_default, { themeColors: true, width: 250, height: 100, title: "Set Border Radius" });
        figma.ui.postMessage({ type: "init-input-dialog", propertyType: "setBorderRadius", title: "Set Border Radius (e.g., 8 or 2*3)", currentValue: commonBorderRadius });
      }
    }
  } else if (figma.command === "setStrokeWidth") {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Please select at least one layer.", { error: true });
      figma.closePlugin();
    } else {
      const isStrokeWeightApplicable = (node) => "strokeWeight" in node;
      if (!selection.some(isStrokeWeightApplicable)) {
        figma.notify("Stroke Width is not applicable to any selected layers.", { error: true, timeout: 3e3 });
        figma.closePlugin();
      } else {
        const commonStrokeWeight = getCommonPropertyValue(selection, "strokeWeight", isStrokeWeightApplicable);
        figma.showUI(input_dialog_default, { themeColors: true, width: 250, height: 100, title: "Set Stroke Width" });
        figma.ui.postMessage({ type: "init-input-dialog", propertyType: "setStrokeWidth", title: "Set Stroke Width (e.g., 1 or 1+1)", currentValue: commonStrokeWeight });
      }
    }
  } else if (figma.command === "setStrokeColour") {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Please select at least one layer.", { error: true });
      figma.closePlugin();
    } else {
      const isStrokeColorApplicable = (node) => "strokes" in node;
      if (!selection.some(isStrokeColorApplicable)) {
        figma.notify("Stroke Color is not applicable to any selected layers.", { error: true, timeout: 3e3 });
        figma.closePlugin();
      } else {
        const commonStrokeColorHex = getCommonSolidPaintColorHex(selection, "strokes");
        figma.showUI(input_dialog_default, { themeColors: true, width: 250, height: 100, title: "Set Stroke Color" });
        figma.ui.postMessage({ type: "init-input-dialog", propertyType: "setStrokeColour", title: "Set Stroke Color (e.g., #FF0000)", currentValue: commonStrokeColorHex });
      }
    }
  } else if (figma.command === "setFillColour") {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Please select at least one layer.", { error: true });
      figma.closePlugin();
    } else {
      const isFillColorApplicable = (node) => "fills" in node;
      if (!selection.some(isFillColorApplicable)) {
        figma.notify("Fill Color is not applicable to any selected layers.", { error: true, timeout: 3e3 });
        figma.closePlugin();
      } else {
        const commonFillColorHex = getCommonSolidPaintColorHex(selection, "fills");
        figma.showUI(input_dialog_default, { themeColors: true, width: 250, height: 100, title: "Set Fill Color" });
        figma.ui.postMessage({ type: "init-input-dialog", propertyType: "setFillColour", title: "Set Fill Color (e.g., #00FF00)", currentValue: commonFillColorHex });
      }
    }
  } else if (figma.command === "setGap") {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Please select at least one layer.", { error: true });
      figma.closePlugin();
    } else {
      if (!selection.some(isValidAutoLayoutNode)) {
        figma.notify("Gap is not applicable to any selected Auto Layout layers.", { error: true, timeout: 3e3 });
        figma.closePlugin();
      } else {
        const commonGap = getCommonPropertyValue(selection, "itemSpacing", isValidAutoLayoutNode);
        figma.showUI(input_dialog_default, { themeColors: true, width: 250, height: 100, title: "Set Gap" });
        figma.ui.postMessage({ type: "init-input-dialog", propertyType: "setGap", title: "Set Gap (e.g., 8 or 10-2)", currentValue: commonGap });
      }
    }
  } else if (figma.command === "t.s") {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Please select at least one text layer.", { error: true });
      figma.closePlugin();
    } else {
      const isTextNode = (node) => node.type === "TEXT" && "fontSize" in node;
      const textNodes = selection.filter(isTextNode);
      if (textNodes.length === 0) {
        figma.notify("Font Size is not applicable to any selected layers.", { error: true, timeout: 3e3 });
        figma.closePlugin();
      } else {
        const commonFontSize = getCommonPropertyValue(textNodes, "fontSize", isTextNode);
        figma.showUI(input_dialog_default, { themeColors: true, width: 250, height: 100, title: "Set Font Size" });
        figma.ui.postMessage({ type: "init-input-dialog", propertyType: "setTextSize", title: "Set Font Size (e.g., 16)", currentValue: commonFontSize });
      }
    }
  } else if (figma.command === "t.ls") {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Please select at least one text layer.", { error: true });
      figma.closePlugin();
    } else {
      const isTextNodeWithLetterSpacing = (node) => node.type === "TEXT" && "letterSpacing" in node;
      const textNodes = selection.filter(isTextNodeWithLetterSpacing);
      if (textNodes.length === 0) {
        figma.notify("Letter Spacing is not applicable to any selected layers.", { error: true, timeout: 3e3 });
        figma.closePlugin();
      } else {
        const commonLetterSpacing = getCommonLetterSpacingValue(textNodes);
        figma.showUI(input_dialog_default, { themeColors: true, width: 250, height: 100, title: "Set Letter Spacing" });
        figma.ui.postMessage({ type: "init-input-dialog", propertyType: "setTextLetterSpacing", title: "Set Letter Spacing (e.g., 2px or 5%)", currentValue: commonLetterSpacing });
      }
    }
  } else if (figma.command) {
    console.log("Unknown or unhandled command, closing plugin:", figma.command);
    figma.notify(`Command "${figma.command}" is not recognized or has no specific handler.`, { error: true, timeout: 3e3 });
    figma.closePlugin();
  }
})();
