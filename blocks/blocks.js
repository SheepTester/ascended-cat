// Relies on blocks/workspace, blocks/scripts, blocks/block, blocks/constants

/**
 * Issues:
 * - Cannot add blocks to an existing category
 * - Should be able to get a category or block using a method
 * - Get translations from ID
 */

class Blocks {
  constructor (initCategories) {
    this.language = null
    this.categories = []
    for (const category of initCategories) {
      this.addCategory(category)
    }
    this._id = 0
    this.clickListeners = {}
    this.dragListeners = {}
    this.dropListeners = {}
    this._workspaces = []

    this._dragSvg = Elem('svg', {class: 'block-dragged'}, [], true)
    document.body.appendChild(this._dragSvg)
    this._dragging = 0
  }

  addCategory (category) {
    this.categories.push(category)
  }

  onClick (elem, fn) {
    const id = ++this._id
    this.clickListeners[id] = fn
    elem.dataset.blockClick = id
  }

  onDrag (elem, fn) {
    const id = ++this._id
    this.dragListeners[id] = fn
    elem.dataset.blockDrag = id
  }

  onDrop (elem, listeners) {
    const id = ++this._id
    this.dropListeners[id] = listeners
    elem.dataset.blockDrop = id
  }

  dragBlocks ({script, dx, dy}) {
    if (!this._dragging) {
      document.body.classList.add('block-dragging-blocks')
    }
    this._dragging++
    this._dragSvg.appendChild(script.elem)
    let possibleDropTarget
    return {
      move: (x, y) => {
        script.setPosition(x - dx, y - dy)
        const dropTarget = document.elementFromPoint(x, y).closest('[data-block-drop]')
        possibleDropTarget = this.dropListeners[dropTarget.dataset.blockDrop]
      },
      end: () => {
        this._dragging--
        if (!this._dragging) {
          document.body.classList.remove('block-dragging-blocks')
        }
        this._dragSvg.removeChild(script.elem)
        if (possibleDropTarget && possibleDropTarget.acceptDrop) {
          const {x, y} = script.position
          possibleDropTarget.acceptDrop(script, x, y)
        }
      }
    }
  }

  updateRects () {
    this._workspaces.forEach(workspace => {
      workspace.updateRect()
    })
  }

  createPaletteWorkspace (wrapper) {
    const workspace = new PaletteWorkspace(this, wrapper)
    this._workspaces.push(workspace)
    return workspace
  }

  createWorkspace (wrapper) {
    const workspace = new Workspace(this, wrapper)
    this._workspaces.push(workspace)
    return workspace
  }

  createScript (initBlocks) {
    return new Script(this, initBlocks)
  }

  createBlock (initBlock) {
    return new Block(this, initBlock)
  }
}

Blocks.BlockType = BlockType

Blocks.ArgumentType = ArgumentType
