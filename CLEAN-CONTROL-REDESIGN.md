# 🎮 Clean Control System Redesign

## Current Problems
- Overcomplicated multi-state ESC system
- Conflicts with existing build mode (TAB)
- JSX syntax errors from complex UI logic
- Duplicated functionality

## **Simple, Clean Design**

### **Core Principles**
1. **ESC** = Simple menu toggle (original intent)
2. **TAB** = Build mode toggle (existing, works fine)
3. **Right-click** = Context menus (only when NOT in build mode)
4. **Clean separation** between build mode and normal mode

---

## **Control Flow**

### **Normal Mode (Pointer Locked)**
- **View**: Clean immersive interface
- **ESC**: Toggle main menu (unlock pointer)
- **TAB**: Enter build mode (if admin)
- **Right-click**: Nothing (pointer is locked)

### **Menu Open (Pointer Unlocked)**  
- **View**: Settings menu with AAA graphics options
- **ESC**: Close menu (lock pointer if nothing else open)
- **TAB**: Enter build mode (close menu first)
- **Right-click**: Floating app menus on objects

### **Build Mode (Pointer Unlocked)**
- **View**: Build UI, transform controls
- **ESC**: Toggle settings menu
- **TAB**: Exit build mode
- **Right-click**: Inspect apps (existing behavior)

---

## **Implementation Strategy**

### **1. ClientUI Simplification**
```javascript
// Simple ESC handling
if (this.control.escape.pressed) {
  if (this.state.pane || this.state.app) {
    // Close open panes first
    this.state.pane = null
    this.state.app = null
    this.broadcast()
  } else {
    // Toggle main menu
    this.toggleMenu()
  }
}

// Right-click context menus (only when not in build mode)
const buildMode = this.world.systems.builder?.enabled
if (!buildMode && !this.control.pointer.locked && this.control.pointerSecondary.pressed) {
  this.handleObjectRightClick()
}
```

### **2. Clean UI State**
```javascript
this.state = {
  visible: true,
  active: false,        // true when pointer is locked
  app: null,
  pane: null,
  menuOpen: false,      // main settings menu
  reticleSuppressors: 0,
}
```

### **3. Simple Sidebar Logic**
```jsx
{/* Show sidebar when menu is open OR cursor is unlocked */}
{(ui.menuOpen || !ui.active) && (
  <div className='sidebar'>
    {/* Main settings when menu is open */}
    {ui.menuOpen && <Prefs world={world} />}
    
    {/* Build tools when in build mode */}
    {/* App inspector when app is selected */}
  </div>
)}
```

---

## **User Experience**

### **Discovery**
1. Load world → Clean interface, pointer locked
2. ESC hint appears: "Press ESC for Menu"
3. TAB hint appears (if admin): "Press TAB for Build Mode"

### **Settings**
1. **ESC** → Menu opens, pointer unlocks
2. Adjust graphics settings
3. **ESC** → Menu closes, pointer locks

### **Building** 
1. **TAB** → Build mode, pointer unlocks
2. Select/move objects with existing controls
3. **TAB** → Exit build mode

### **Object Interaction**
1. **ESC** → Menu opens (pointer unlocked)
2. **Right-click objects** → Floating context menus
3. Edit apps directly

---

## **Benefits of Clean Design**

✅ **No Conflicts**: ESC and TAB have distinct, clear purposes  
✅ **No Multi-State**: Simple boolean states, easy to understand  
✅ **Existing Build Mode**: Keeps working exactly as before  
✅ **Progressive Disclosure**: Hints appear to teach users  
✅ **Clean Code**: No complex conditional JSX  
✅ **Professional UX**: Matches AAA game expectations  

---

## **Implementation Plan**

1. **Reset ClientUI** to simple ESC menu toggle
2. **Fix Sidebar JSX** with clean conditional rendering  
3. **Test build mode** integration
4. **Add context menus** for right-click on objects
5. **Polish hints** and animations

**This will create a professional, conflict-free control system! 🎮✨** 