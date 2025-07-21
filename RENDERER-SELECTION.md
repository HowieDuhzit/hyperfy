# 🎮 Renderer Selection Feature

## 🎯 **Overview**

The Renderer Selection feature allows users to manually choose between WebGPU, WebGL, or automatic detection in Hyperfy's graphics settings. This provides greater control over the rendering backend and enables testing, debugging, and compatibility management.

---

## ✨ **Key Features**

### **🔧 Manual Renderer Control**
- **Auto (Recommended)**: Automatically detects and uses WebGPU when available, falls back to WebGL
- **WebGPU**: Forces WebGPU renderer with fallback to WebGL if unavailable
- **WebGL**: Forces WebGL renderer for maximum compatibility

### **🎮 User-Friendly Settings**
- **Integrated UI**: Available in all graphics settings locations (SettingsPane, MenuMain, Sidebar)
- **Clear Descriptions**: Helpful hints explaining each renderer option
- **Reload Management**: Automatic page reload prompt when changing renderers

### **🛡️ Robust Fallback System**
- **Graceful Degradation**: Requested renderer unavailable → automatic fallback
- **Console Logging**: Detailed logging of renderer selection process
- **Error Handling**: Safe fallbacks with informative warnings

---

## 🔧 **Technical Implementation**

### **Preference Storage**
- **Storage**: Persisted in browser local storage via `ClientPrefs` system
- **Version Management**: Preference versioning (v5) for future compatibility
- **Default Value**: `'auto'` for new users

### **Renderer Selection Logic**
```javascript
async function getRenderer(preference = 'auto') {
  switch (preference) {
    case 'webgpu':
      // Force WebGPU with WebGL fallback
    case 'webgl':  
      // Force WebGL
    case 'auto':
    default:
      // Auto-detect (WebGPU preferred)
  }
}
```

### **Console Output Examples**
```
🎮 Renderer preference: webgpu
✅ Using WebGPU renderer (user preference)

🎮 Renderer preference: webgl  
✅ Using WebGL renderer (user preference)

🎮 Renderer preference: auto
✅ Using WebGPU renderer (auto-detected)

⚠️ WebGPU requested but not supported, falling back to WebGL
✅ Using WebGL renderer (fallback)
```

---

## 🎮 **User Interface**

### **Setting Location**
The renderer setting appears in **all three graphics settings locations**:

1. **Main Settings Panel** (SettingsPane.js)
   - Full settings overlay with detailed options
   - Label: "Renderer" 
   - Options: "Auto (Recommended)", "WebGPU", "WebGL"

2. **Mobile Menu** (MenuMain.js)
   - Compact mobile-friendly interface
   - Label: "Renderer"
   - Options: "Auto", "WebGPU", "WebGL"

3. **Sidebar Settings** (Sidebar.js)
   - Quick access side panel
   - Label: "Renderer" 
   - Hint: "Choose between WebGPU, WebGL, or automatic detection (requires reload)"

### **Setting Interaction**
```
📋 User Experience Flow:
1. User opens graphics settings
2. Finds "Renderer" option
3. Selects desired renderer (Auto/WebGPU/WebGL)
4. If changed → Automatic reload prompt appears
5. User confirms → Page reloads with new renderer
6. New renderer initializes with preference applied
```

### **Reload Management**
- **Smart Detection**: Only prompts reload when renderer actually changes
- **User Choice**: "Renderer change requires a page reload. Reload now?"
- **Graceful Handling**: Non-disruptive preference saving

---

## 🔍 **Use Cases**

### **For Developers**
- **Performance Testing**: Compare WebGL vs WebGPU performance
- **Debugging**: Isolate renderer-specific issues
- **Feature Testing**: Test WebGPU-specific features vs fallbacks
- **Compatibility**: Force WebGL for older device testing

### **For Users**
- **Compatibility Issues**: Force WebGL if WebGPU causes problems
- **Performance Optimization**: Choose best renderer for specific hardware
- **Stability**: Use WebGL for maximum stability on uncertain systems
- **Future-Proofing**: Opt into WebGPU for cutting-edge performance

### **For System Administrators**
- **Deployment Control**: Standardize renderer across organization
- **Troubleshooting**: Eliminate renderer variables in support
- **Performance Management**: Optimize for specific hardware configurations

---

## 🛠️ **Technical Details**

### **Preference Integration**
```javascript
// ClientPrefs.js
this.renderer = data.renderer ? data.renderer : 'auto' // auto, webgpu, webgl

setRenderer(value) {
  this.modify('renderer', value)
}
```

### **Graphics System Integration**
```javascript
// ClientGraphics.js  
const rendererPreference = this.world.prefs?.renderer || 'auto'
this.renderer = await getRenderer(rendererPreference)
```

### **UI State Management**
```javascript
// All UI components
const [renderer, setRenderer] = useState(world.prefs.renderer)

// Change handlers with reload logic
onChange={newRenderer => {
  const currentRenderer = world.prefs.renderer
  world.prefs.setRenderer(newRenderer)
  if (newRenderer !== currentRenderer) {
    // Prompt for reload
  }
}}
```

---

## 🎯 **Benefits**

### **🚀 Performance Benefits**
- **Optimal Selection**: Users can choose best renderer for their hardware
- **WebGPU Performance**: Manual access to cutting-edge WebGPU performance
- **WebGL Stability**: Fallback to mature, stable WebGL when needed

### **🛡️ Compatibility Benefits**  
- **Hardware Support**: Handle varied GPU driver support gracefully
- **Browser Differences**: Account for varying WebGPU implementation status
- **Debugging**: Isolate renderer-specific issues quickly

### **📊 Development Benefits**
- **A/B Testing**: Easy comparison between renderers
- **Feature Development**: Test new WebGPU features with easy fallback
- **User Support**: Quick troubleshooting by changing renderer

---

## 🔬 **Quality Assurance**

### **✅ Testing Scenarios**
- **Setting Persistence**: Renderer preference survives page reloads
- **Fallback Logic**: Requested renderer unavailable → safe fallback
- **UI Consistency**: All three settings locations work identically
- **Reload Logic**: Only prompts when renderer actually changes

### **✅ Browser Compatibility**
| Browser | WebGPU Option | WebGL Option | Auto Option |
|---------|---------------|--------------|-------------|
| **Chrome** | ✅ Full Support | ✅ Full Support | ✅ WebGPU Preferred |
| **Edge** | ✅ Full Support | ✅ Full Support | ✅ WebGPU Preferred |
| **Firefox** | 🔄 Experimental | ✅ Full Support | ✅ WebGL Fallback |
| **Safari** | 🔄 Future | ✅ Full Support | ✅ WebGL Fallback |

### **✅ Error Handling**
- **Invalid Preference**: Defaults to 'auto' with warning
- **Renderer Failure**: Graceful fallback with console logging
- **UI Errors**: Safe state management with null checks

---

## 🚀 **Future Enhancements**

### **Planned Features**
- **Renderer Capabilities Display**: Show what features each renderer supports
- **Performance Hints**: Recommend optimal renderer based on hardware detection
- **Advanced Options**: Expose WebGPU-specific settings (power preference, etc.)
- **Automatic Switching**: Smart renderer selection based on performance metrics

### **Advanced Integration**
- **Enhanced Stats**: Show which renderer is currently active in performance stats
- **Renderer-Specific Settings**: Different post-processing options per renderer
- **Hot Switching**: Runtime renderer switching without reload (future WebGPU feature)

---

## 📋 **Implementation Summary**

### **Files Modified**
- **ClientPrefs.js**: Added renderer preference storage and management
- **ClientGraphics.js**: Enhanced renderer selection logic with preference support  
- **SettingsPane.js**: Added renderer selection UI to main settings
- **MenuMain.js**: Added renderer selection to mobile graphics menu
- **Sidebar.js**: Added renderer selection to sidebar settings

### **New Features Added**
- ✅ **Renderer Preference Storage** - Persistent user choice
- ✅ **Smart Renderer Selection** - Respects user preference with fallbacks
- ✅ **Comprehensive UI Integration** - Available in all graphics settings
- ✅ **Reload Management** - Smooth user experience for renderer changes
- ✅ **Console Logging** - Detailed renderer selection debugging

---

## 🎉 **Result: Complete Renderer Control**

**Users now have full control over the rendering backend with:**
- **🎮 Easy Selection** - Simple dropdown in all graphics settings
- **🛡️ Safe Fallbacks** - Robust error handling and graceful degradation
- **📊 Clear Feedback** - Console logging and user-friendly reload prompts
- **🚀 Performance Control** - Choose optimal renderer for specific needs
- **🔧 Developer Tools** - Perfect for testing, debugging, and comparison

**The renderer selection feature provides professional-grade control while maintaining user-friendly simplicity! 🎯** 