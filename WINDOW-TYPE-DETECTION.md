# Window Type Detection Feature

## 🎯 Overview

Added intelligent window type detection that parses the user's prompt to determine which window style to create (Double-Hung, Sliding, or Fixed).

---

## 🪟 Supported Window Types

The Revit plugin supports 3 window types:

### 1. 📋 Double-Hung Window
**Revit Style:** `DoubleHungWindow`

**Keywords:** `double-hung`, `double hung`

**Example Prompt:** "Create a 900 mm wide, 1200 mm high double-hung window"

**Description:** Traditional window with two vertically sliding sashes.

---

### 2. ⬌ Sliding Window
**Revit Style:** `SlidingDoubleWindow`

**Keywords:** `sliding`

**Example Prompt:** "Create a 1200 mm wide, 1500 mm high sliding window"

**Description:** Window with horizontally sliding panels.

---

### 3. ⬜ Fixed Window
**Revit Style:** `FixedWindow`

**Keywords:** `fixed`

**Example Prompt:** "Create an 800 mm wide, 1000 mm high fixed window"

**Description:** Non-opening, stationary window.

---

## 🔧 Implementation

### Detection Logic (routes/bim-llm.js)

```javascript
// Determine window type from family name (which comes from the original prompt)
let windowType = "DoubleHungWindow"; // Default
const familyNameLower = familyName.toLowerCase();

if (familyNameLower.includes('sliding')) {
    windowType = "SlidingDoubleWindow";
} else if (familyNameLower.includes('fixed')) {
    windowType = "FixedWindow";
} else if (familyNameLower.includes('double-hung') || familyNameLower.includes('double hung')) {
    windowType = "DoubleHungWindow";
}

console.log(`Detected window type: ${windowType} from family name: ${familyName}`);
```

### How It Works

1. **User enters prompt** (e.g., "Create a sliding window")
2. **Gemini generates SIR** with family name derived from prompt
3. **`convertSIRToAPSParams()`** parses the family name for keywords
4. **Window type is detected** and set as `WindowStyle` parameter
5. **Revit plugin receives** the correct `WindowStyle` string
6. **Appropriate window family is created**

---

## 🎨 Updated Example Buttons

The welcome card now shows 3 example buttons, one for each window type:

```
┌──────────────────────────────────────────────────────────────┐
│  🤖 Welcome to famAI!                                        │
│  Describe your window family in natural language            │
│                                                              │
│  [📋 900mm x 1200mm]  [⬌ 1200mm x 1500mm]  [⬜ 800mm x 1000mm] │
│     double-hung          sliding              fixed         │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Before vs After

### Before
- ❌ **Always created Double-Hung windows** regardless of prompt
- ❌ `WindowStyle` was hardcoded to `1` (numeric)
- ❌ No way to create Sliding or Fixed windows

### After
- ✅ **Detects window type from keywords** in prompt
- ✅ `WindowStyle` is set to correct string (`"DoubleHungWindow"`, `"SlidingDoubleWindow"`, or `"FixedWindow"`)
- ✅ **Works automatically** - no special syntax required
- ✅ **Defaults to Double-Hung** if no keyword found

---

## 🧪 How to Test

### Test Double-Hung (Default)
1. Use prompt: "Create a 900 mm wide, 1200 mm high double-hung window"
2. Check server logs for: `Detected window type: DoubleHungWindow`
3. Download RFA and verify it's a double-hung style

### Test Sliding
1. Use prompt: "Create a 1200 mm wide, 1500 mm high sliding window"
2. Check server logs for: `Detected window type: SlidingDoubleWindow`
3. Download RFA and verify it's a sliding style

### Test Fixed
1. Use prompt: "Create an 800 mm wide, 1000 mm high fixed window"
2. Check server logs for: `Detected window type: FixedWindow`
3. Download RFA and verify it's a fixed (non-opening) style

---

## 🔍 Server Logs

When you create a family, you'll see this in the server logs:

```
Detected window type: SlidingDoubleWindow from family name: Sliding Window
Converting SIR to APS parameters...
Converted SIR to APS params: {
  FileName: 'Sliding Window.rfa',
  FamilyType: 1,
  WindowParams: {
    WindowStyle: "SlidingDoubleWindow",  ← Correct type!
    ...
  }
}
```

---

## 💡 Usage Tips

### Natural Language Support
The system is flexible and understands various phrasings:
- ✅ "double-hung window"
- ✅ "double hung window"
- ✅ "sliding double window"
- ✅ "fixed window"
- ✅ "Create a sliding..."
- ✅ "Make a fixed..."

### Case Insensitive
Keywords are case-insensitive:
- ✅ "Sliding" = "sliding" = "SLIDING"
- ✅ "Fixed" = "fixed" = "FIXED"

### Order Doesn't Matter
Keywords can appear anywhere in the prompt:
- ✅ "sliding window 1200mm wide"
- ✅ "1200mm wide sliding window"
- ✅ "window that's sliding and 1200mm"

---

## 🚀 Future Enhancements

Potential improvements:
1. **More window types** (Casement, Awning, etc.)
2. **Door support** (Single-leaf, Double-leaf, etc.)
3. **Advanced options** (Glazing type, frame material, etc.)
4. **Visual preview** of window type before creation

---

## ✅ Summary

**What Changed:**
- ✅ Example prompts updated (3 buttons, one per type)
- ✅ Window type detection logic added
- ✅ `WindowStyle` changed from numeric to string format
- ✅ Console logging for debugging
- ✅ Default fallback to Double-Hung

**Result:**
- 🎉 Users can now create **3 different window types**
- 🎉 Detection is **automatic** from natural language
- 🎉 Example buttons showcase all types
- 🎉 Server logs show detected type for debugging

---

<div align="center">
  <h2>🪟 Window Types Now Work!</h2>
  <p><em>Try the example buttons to see each window type in action!</em></p>
</div>


