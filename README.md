# ascended-cat
Scratch for three.js

## Blocks

[Playground](./blocks/playground.html)

### TODO

- Angle and colour picker
- Touch keypad (Typing should giving focus to input though)
- Somehow be able to click the dropdown arrow while editing an input
- Relabel, duplicate
- Support preference for , or . decimals
- Should store numbers as strings so that long numbers will be left the way they are!
- Dragging a reporter from inside an input to replace the input's block is not undoable because it tries to put it back inside the input's block but the input's block is not inside the input it was in...
  1. `move <not <>> steps`
  2. `move <not <[] = []>> steps`
  3. `move <[] = []> steps` `<not <>>`
  4. *undo* - Error
    - Tries to move `<[] = []>` into `<not <>>`'s input but it uses the selector for when it was inside the move _ steps block
- Undo/redo for input value changes
- Show currently selected item in menu?
