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
      (node) => "paddingLeft" in node && "paddingRight" in node && "paddingTop" in node && "paddingBottom" in node
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
  figma.ui.onmessage = async (msg) => {
    if (!msg || !msg.type) return;
    const selection = figma.currentPage.selection;
    switch (msg.type) {
      case "submit-value":
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
                  if (!isNaN(num)) {
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
                    const strokableNode = node;
                    if (num > 0 && strokableNode.strokes.length === 0) {
                      strokableNode.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
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
              case "setStrokeColour":
                if ("strokes" in node) {
                  const color = parseColor(value);
                  if (color) {
                    const strokableNode = node;
                    strokableNode.strokes = [{ type: "SOLID", color }];
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
                    const fillableNode = node;
                    fillableNode.fills = [{ type: "SOLID", color }];
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
        break;
      case "close-plugin":
        figma.closePlugin();
        break;
      // Messages from auto-alignment-control.html (for 'aa' command)
      case "set-alignment":
        if (figma.command === "aa") {
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
        break;
      case "toggle-distribution":
        if (figma.command === "aa") {
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
        break;
      case "get-initial-visibility":
        if (figma.command === "aa") {
          sendCurrentStateToUIForAA();
        }
        break;
      case "set-layout-direction":
        if (figma.command === "aa") {
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
        break;
      case "set-stroke":
        let appliedStrokeCount = 0;
        for (const node of selection) {
          if ("strokes" in node && "strokeWeight" in node) {
            const strokeWeight = msg.value;
            const strokableNode = node;
            if (strokeWeight > 0) {
              if (strokableNode.strokes.length === 0) {
                strokableNode.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
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
  if (figma.command === "aa") {
    figma.showUI(__html__, { width: 180, height: 180, themeColors: true });
    sendCurrentStateToUIForAA();
    figma.on("selectionchange", () => {
      if (figma.command === "aa") {
        sendCurrentStateToUIForAA();
      }
    });
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
  } else if (figma.command === "ls..") {
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
  } else if (figma.command === "s1" || figma.command === "s0") {
    const selection = figma.currentPage.selection;
    let S = selection.length;
    if (S === 0) {
      figma.notify("Please select at least one layer.", { error: true });
      figma.closePlugin();
    } else {
      let modifiedCount = 0;
      const strokeWeight = figma.command === "s1" ? 1 : 0;
      const commandName = `Set Stroke to ${strokeWeight}`;
      for (const node of selection) {
        if ("strokes" in node && "strokeWeight" in node) {
          const strokableNode = node;
          if (strokeWeight > 0) {
            if (strokableNode.strokes.length === 0) {
              strokableNode.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
            }
            strokableNode.strokeWeight = strokeWeight;
          } else {
            strokableNode.strokeWeight = 0;
          }
          modifiedCount++;
        }
      }
      if (modifiedCount > 0) {
        figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${modifiedCount === 1 ? "" : "s"}.`);
      } else {
        figma.notify(`No applicable layers found for "${commandName}".`, { timeout: 3e3 });
      }
      figma.closePlugin();
    }
  } else if (figma.command === "fill1" || figma.command === "fill0") {
    const selection = figma.currentPage.selection;
    let S = selection.length;
    if (S === 0) {
      figma.notify("Please select at least one layer.", { error: true });
      figma.closePlugin();
    } else {
      let modifiedCount = 0;
      const commandName = figma.command === "fill1" ? "Add Default Fill" : "Remove All Fills";
      for (const node of selection) {
        if ("fills" in node) {
          const fillableNode = node;
          if (figma.command === "fill1") {
            fillableNode.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
          } else {
            fillableNode.fills = [];
          }
          modifiedCount++;
        }
      }
      if (modifiedCount > 0) {
        figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${modifiedCount === 1 ? "" : "s"}.`);
      } else {
        figma.notify(`No applicable layers found for "${commandName}".`, { timeout: 3e3 });
      }
      figma.closePlugin();
    }
  } else if (figma.command === "aa.h" || figma.command === "aa.v") {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Please select at least one Auto Layout layer.", { error: true });
      figma.closePlugin();
    } else {
      let modifiedCount = 0;
      const newLayoutMode = figma.command === "aa.h" ? "HORIZONTAL" : "VERTICAL";
      const commandName = `Set Auto Layout to ${newLayoutMode.toLowerCase()}`;
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
          node.layoutMode = newLayoutMode;
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
      if (modifiedCount > 0) {
        figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${modifiedCount === 1 ? "" : "s"}.`);
      } else {
        figma.notify(`No applicable Auto Layout layers found for "${commandName}".`, { timeout: 3e3 });
      }
      figma.closePlugin();
    }
  } else {
    const selection = figma.currentPage.selection;
    let S = selection.length;
    const commandsRequiringSelection = ["wh", "hh", "wf", "hf", "p0", "p16", "br8", "br0", "gap0", "gap8", "gap16"];
    if (S === 0 && commandsRequiringSelection.includes(figma.command)) {
      figma.notify("Please select at least one layer.", { error: true });
      figma.closePlugin();
    } else if (figma.command === "gap0" || figma.command === "gap8" || figma.command === "gap16") {
      let modifiedCount = 0;
      const gapValue = figma.command === "gap0" ? 0 : figma.command === "gap8" ? 8 : 16;
      const commandName = `Set Gap to ${gapValue}`;
      for (const node of selection) {
        if (isValidAutoLayoutNode(node)) {
          node.itemSpacing = gapValue;
          modifiedCount++;
        }
      }
      if (modifiedCount > 0) {
        figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${modifiedCount === 1 ? "" : "s"}.`);
      } else {
        figma.notify(`No applicable Auto Layout layers found for "${commandName}".`, { timeout: 3e3 });
      }
      figma.closePlugin();
    } else if (commandsRequiringSelection.includes(figma.command) || ["wh", "hh", "wf", "hf", "p0", "p16", "br8", "br0"].includes(figma.command)) {
      (async () => {
        let modifiedCount = 0;
        let commandName = "";
        for (const node of selection) {
          try {
            if (node.type === "GROUP") {
              commandName = figma.command === "wh" ? "Width to Hug" : figma.command === "hh" ? "Height to Hug" : figma.command === "wf" ? "Width to Fill" : "Height to Fill";
              if (figma.command === "wh" || figma.command === "hh") {
                figma.notify(`Group "${node.name}" naturally hugs its content.`, { timeout: 2e3 });
              } else {
                figma.notify(`Fill/Fixed sizing is not directly applicable to Groups. Consider Frame with Auto Layout.`, { timeout: 3e3 });
              }
            } else if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET" || node.type === "INSTANCE" || node.type === "TEXT" || node.type === "RECTANGLE") {
              const operableNode = node;
              if (figma.command === "wh") {
                commandName = "Width to Hug";
                if (operableNode.type === "TEXT") {
                  const textNode = operableNode;
                  const parentIsAutoLayout = textNode.parent && textNode.parent.type === "FRAME" && textNode.parent.layoutMode !== "NONE";
                  if (parentIsAutoLayout) {
                    textNode.layoutSizingHorizontal = "HUG";
                  } else {
                    if (textNode.fontName !== figma.mixed) {
                      await figma.loadFontAsync(textNode.fontName);
                    } else {
                      const len = textNode.characters.length;
                      const uniqueFonts = /* @__PURE__ */ new Set();
                      for (let i = 0; i < len; i++) {
                        const font = textNode.getRangeFontName(i, i + 1);
                        const fontKey = JSON.stringify(font);
                        if (!uniqueFonts.has(fontKey)) {
                          await figma.loadFontAsync(font);
                          uniqueFonts.add(fontKey);
                        }
                      }
                    }
                    textNode.textAutoResize = "WIDTH_AND_HEIGHT";
                  }
                } else {
                  operableNode.layoutSizingHorizontal = "HUG";
                }
                modifiedCount++;
              } else if (figma.command === "hh") {
                commandName = "Height to Hug";
                if (operableNode.type === "TEXT") {
                  const textNode = operableNode;
                  const parentIsAutoLayout = textNode.parent && textNode.parent.type === "FRAME" && textNode.parent.layoutMode !== "NONE";
                  if (parentIsAutoLayout) {
                    textNode.layoutSizingVertical = "HUG";
                  } else {
                    if (textNode.fontName !== figma.mixed) {
                      await figma.loadFontAsync(textNode.fontName);
                    } else {
                      const len = textNode.characters.length;
                      const uniqueFonts = /* @__PURE__ */ new Set();
                      for (let i = 0; i < len; i++) {
                        const font = textNode.getRangeFontName(i, i + 1);
                        const fontKey = JSON.stringify(font);
                        if (!uniqueFonts.has(fontKey)) {
                          await figma.loadFontAsync(font);
                          uniqueFonts.add(fontKey);
                        }
                      }
                    }
                    textNode.textAutoResize = "HEIGHT";
                  }
                } else {
                  operableNode.layoutSizingVertical = "HUG";
                }
                modifiedCount++;
              } else if (figma.command === "wf") {
                commandName = "Width to Fill";
                if (operableNode.parent && operableNode.parent.type === "FRAME" && operableNode.parent.layoutMode !== "NONE") {
                  operableNode.layoutSizingHorizontal = "FILL";
                  modifiedCount++;
                } else {
                  figma.notify(`"${operableNode.name}" cannot be set to Fill Width as its parent is not an Auto Layout frame.`, { timeout: 3e3 });
                }
              } else if (figma.command === "hf") {
                commandName = "Height to Fill";
                if (operableNode.parent && operableNode.parent.type === "FRAME" && operableNode.parent.layoutMode !== "NONE") {
                  operableNode.layoutSizingVertical = "FILL";
                  modifiedCount++;
                } else {
                  figma.notify(`"${operableNode.name}" cannot be set to Fill Height as its parent is not an Auto Layout frame.`, { timeout: 3e3 });
                }
              } else if (figma.command === "p0") {
                commandName = "Set All Padding to 0";
                if ("paddingTop" in operableNode && "paddingBottom" in operableNode && "paddingLeft" in operableNode && "paddingRight" in operableNode) {
                  const paddedNode = operableNode;
                  paddedNode.paddingTop = 0;
                  paddedNode.paddingBottom = 0;
                  paddedNode.paddingLeft = 0;
                  paddedNode.paddingRight = 0;
                  modifiedCount++;
                }
              } else if (figma.command === "p16") {
                commandName = "Set All Padding to 16";
                if ("paddingTop" in operableNode && "paddingBottom" in operableNode && "paddingLeft" in operableNode && "paddingRight" in operableNode) {
                  const paddedNode = operableNode;
                  paddedNode.paddingTop = 16;
                  paddedNode.paddingBottom = 16;
                  paddedNode.paddingLeft = 16;
                  paddedNode.paddingRight = 16;
                  modifiedCount++;
                }
              } else if (figma.command === "br8") {
                commandName = "Set Border Radius to 8px";
                if ("cornerRadius" in operableNode) {
                  operableNode.cornerRadius = 8;
                  modifiedCount++;
                }
              } else if (figma.command === "br0") {
                commandName = "Set Border Radius to 0px";
                if ("cornerRadius" in operableNode) {
                  operableNode.cornerRadius = 0;
                  modifiedCount++;
                }
              }
            }
          } catch (e) {
            figma.notify(`Error applying to "${node.name}": ${e.message}`, { error: true, timeout: 3e3 });
          }
        }
        if (modifiedCount > 0 && commandName) {
          const plural = modifiedCount === 1 ? "" : "s";
          figma.notify(`Applied "${commandName}" to ${modifiedCount} layer${plural}.`);
        } else if (S > 0 && commandName !== "" && !commandsRequiringSelection.includes(figma.command)) {
          figma.notify(`No applicable layers found for "${commandName}".`, { timeout: 3e3 });
        }
        figma.closePlugin();
      })().catch((e) => {
        console.error("Error in async command execution:", e);
        figma.notify(`An unexpected error occurred: ${e.message}`, { error: true });
        figma.closePlugin();
      });
    } else if (figma.command && !["aa", "setPadding", "setHeight", "setWidth", "setBorderRadius", "setStrokeWidth", "setStrokeColour", "setFillColour", "setGap", "s1", "s0", "fill1", "fill0", "gap0", "gap8", "gap16", "wh", "hh", "wf", "hf", "p0", "p16", "br8", "br0", "aa.h", "aa.v", "t.s", "ls.."].includes(figma.command)) {
      console.log("Unknown command, closing plugin:", figma.command);
      figma.closePlugin();
    }
  }
})();
