// Relies on blocks/workspace, blocks/scripts, blocks/block, blocks/constants,
// utils/math

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
    const id = ++this.constructor._id
    this.clickListeners[id] = fn
    elem.dataset.blockClick = id
  }

  onDrag (elem, fn) {
    const id = ++this.constructor._id
    this.dragListeners[id] = fn
    elem.dataset.blockDrag = id
  }

  onDrop (elem, listeners) {
    const id = ++this.constructor._id
    this.dropListeners[id] = listeners
    elem.dataset.blockDrop = id
  }

  dragBlocks ({script, dx, dy, type, onReady}) {
    if (!this._dragging) {
      document.body.classList.add('block-dragging-blocks')
    }
    this._dragging++
    this._dragSvg.appendChild(script.elem)
    let possibleDropTarget, connections = [], snapPoints, snapTo, ready = false
    onReady.then(() => {
      ready = true
      const {notchX} = Block.renderOptions
      if (type === BlockType.COMMAND) {
        snapPoints = {
          top: [notchX, 0],
          bottom: [notchX, script.measurements.height],
          // innerLoop:
        }
      } else {
        snapPoints = {
          // TODO
        }
      }
      console.log(snapPoints)
    })
    return {
      move: (x, y) => {
        script.setPosition(x - dx, y - dy)
        const elems = document.elementsFromPoint(x, y)
        if (!ready) return
        let dropTargetElem
        for (let i = 0; !dropTargetElem && i < elems.length; i++) {
          dropTargetElem = elems[i].closest('[data-block-drop]')
        }
        if (dropTargetElem) {
          const dropTarget = this.dropListeners[dropTargetElem.dataset.blockDrop]
          if (possibleDropTarget !== dropTarget) {
            possibleDropTarget = dropTarget
            if (type === BlockType.COMMAND) {
              if (dropTarget.getStackBlockConnections) {
                connections = dropTarget.getStackBlockConnections()
              }
            } else {
              if (dropTarget.getReporterConnections) {
                connections = dropTarget.getReporterConnections()
              }
            }
            snapTo = null
          }
          if (ready && connections.length) {
            if (type === BlockType.COMMAND) {
              const closest = connections.reduce((closestSoFar, connection) => {
                //
              })
            } else {
              //
            }
          }
        } else if (possibleDropTarget) {
          possibleDropTarget = null
          connections = []
          snapTo = null
        }
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
    for (const workspace of this._workspaces) {
      workspace.updateRect()
    }
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

  createBlock (initBlock, initParams) {
    return new Block(this, initBlock, initParams)
  }
}

Blocks._id = 0

Blocks.BlockType = BlockType

Blocks.ArgumentType = ArgumentType
