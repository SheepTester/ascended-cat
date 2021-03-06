import { Elem } from '../utils/elem.js'
import { square } from '../utils/math.js'
import { Newsletter } from '../utils/newsletter.js'

import { Workspace, ScriptsWorkspace } from './workspace.js'
import { PaletteWorkspace, paletteRenderOptions } from './palette.js'
import { BlockType, ArgumentType } from './constants.js'
import { Stack, Script } from './scripts.js'
import { Block, getIndicesOf } from './block.js'
import { Space } from './component.js'
import { Input, renderOptions as inputRenderOptions } from './input.js'

function getComponentFromIndices (indicesArray) {
  const [workspace, scriptIndex, ...indices] = indicesArray
  let parent = workspace
  let component = workspace.scripts[scriptIndex]
  for (const index of indices) {
    parent = component
    if (component instanceof Input) {
      component = component.getValue()
      if (!(component instanceof Block)) {
        throw new Error('hwat. The indices point to an input that does not hold a block.')
      }
    }
    if (typeof index === 'number') {
      component = component.components[index]
    } else {
      component = component.getParamComponent(index)
    }
  }
  return {
    workspace,
    parent,
    component,
    index: indices[indices.length - 1]
  }
}

let nextID = 1

class Blocks extends Newsletter {
  constructor (initCategories) {
    super()

    this._language = null
    this._dir = 'ltr'
    this.translations = {
      default: {
        '_.undefinedBlock': '???',
        '_.duplicate': 'Duplicate',
        '_.delete': 'Delete',
        '_.addComment': 'Add comment',
        '_.help': 'Help',
        '_.paramPlaceholder': '_'
      }
    }
    this.menus = {}
    this.categories = {}
    for (const category of initCategories) {
      this.addCategory(category)
    }

    this._undoHistory = []
    this._redoHistory = []

    this.clickListeners = {}
    this.rClickListeners = {}
    this.dragListeners = {}
    this._dropListeners = {}
    this._workspaces = []

    this._dragScale = 1
    this._dragWrapper = Elem('g', {}, [], true)
    document.body.appendChild(Elem('svg', { class: 'block-dragged' }, [
      this._dragWrapper
    ], true))
    this._dragging = 0
  }

  addCategory ({
    id,
    name = `Category ${id}`,
    blocks = [],
    menus = {},
    translationMap = {}
  }) {
    this.categories[id] = {}
    this.translations.default[id] = name
    for (const block of blocks) {
      if (block && typeof block === 'object') {
        this.addBlock(id, block)
      }
    }
    for (const [language, translations] of Object.entries(translationMap)) {
      this.addTranslations(
        language,
        Object.entries(translations)
          .map(([transID, translation]) => [
            transID === '__name__' ? id : `${id}.${transID}`,
            translation
          ])
      )
    }
    for (const [menuID, list] of Object.entries(menus)) {
      this.menus[`${id}.${menuID}`] = list
    }
  }

  addBlock (category, {
    opcode,
    blockType = BlockType.COMMAND,
    text = `block ${opcode}`,
    hat = false,
    terminal = false,
    arguments: args = {},
    alternatives = []
  }) {
    const blockOpcode = `${category}.${opcode}`
    this.translations.default[blockOpcode] = text
    this.categories[category][opcode] = {
      blockType,
      hat,
      terminal,
      args,
      alternatives
    }
    this.trigger('block-added', blockOpcode)
  }

  addTranslations (language = null, translations = []) {
    if (!language) {
      language = 'default'
    }
    if (!this.translations[language]) {
      this.translations[language] = {}
    }
    for (const [id, translation] of translations) {
      this.translations[language][id] = translation
    }
  }

  get language () {
    return this._language
  }

  setLanguage (language) {
    this._language = language
    this.trigger('language-change', language)
  }

  getBlockData (blockOpcode) {
    const [categoryID, opcode] = blockOpcode.split('.')
    const category = this.categories[categoryID]
    return {
      category: category ? categoryID : null,
      blockData: category ? category[opcode] : null,
      opcode
    }
  }

  getTranslation (id) {
    if (this._language && this.translations[this._language] &&
      this.translations[this._language][id] !== undefined) {
      return this.translations[this._language][id]
    } else if (this.translations.default[id] !== undefined) {
      return this.translations.default[id]
    } else if (id[0] === '_') {
      console.warn('No translation for', id)
      return id
    } else {
      return this.getTranslation('_.undefinedBlock')
    }
  }

  get dir () {
    return this._dir
  }

  set dir (dir) {
    if (dir !== 'ltr' && dir !== 'rtl') {
      throw new Error('wucky: Alternative directions are too sophisticated.')
    }
    if (dir !== this._dir) {
      // Flip all scripts horizontally
      for (const workspace of this._workspaces) {
        workspace.flip(dir)
      }
    }
    this._dir = dir
  }

  onClick (elem, fn) {
    const id = nextID++
    this.clickListeners[id] = fn
    elem.dataset.blockClick = id
  }

  onRightClick (elem, fn) {
    const id = nextID++
    this.rClickListeners[id] = fn
    elem.dataset.blockRightClick = id
  }

  onDrag (elem, fn) {
    const id = nextID++
    this.dragListeners[id] = fn
    elem.dataset.blockDrag = id
  }

  onDrop (elem, listeners) {
    const id = nextID++
    this._dropListeners[id] = listeners
    elem.dataset.blockDrop = id
  }

  removeListeners (elem) {
    delete this.clickListeners[elem.dataset.blockClick]
    delete this.rClickListeners[elem.dataset.blockRightClick]
    delete this.dragListeners[elem.dataset.blockDrag]
    delete this._dropListeners[elem.dataset.blockDrop]
    return 'Have a nice day!'
  }

  setDragZoom (scale) {
    this._dragScale = scale
    this._dragWrapper.setAttributeNS(null, 'transform', `scale(${scale})`)
  }

  dragBlocks ({ target, initMouseX, initMouseY, dx, dy, type }) {
    if (!this._dragging) {
      document.body.classList.add('block-dragging-blocks')
    }
    this._dragging++
    // If the first block is a reporter, then only pull out one block.
    const script = this._grabTarget(target, type === BlockType.COMMAND ? Infinity : 1)
    script.setPosition((initMouseX + dx) / this._dragScale, (initMouseY + dy) / this._dragScale)
    this._dragWrapper.appendChild(script.elem)
    const undoEntry = { type: 'transfer', a: target, blocks: script.components.length }
    let possibleDropTarget
    let connections = []
    let snapPoints
    let snapTo
    let wrappingC = false
    const spacePlaceholder = new Space()
    const snapMarker = Elem('path', { class: 'block-snap-marker' }, [], true)
    const { notchLeft, notchTotalWidth, notchToLeft, notchToRight } = Block.renderOptions
    let normalInsertPath
    script.resize().then(() => {
      const dir = this._dir === 'rtl' ? -1 : 1
      const { notchX, branchWidth } = Block.renderOptions
      if (type === BlockType.COMMAND) {
        const firstLoop = script.components[0].components
          .find(component => component instanceof Stack)
        snapPoints = {
          top: script.components[0].blockData.hat ? null : [notchX * dir, 0],
          bottom: script.components[script.components.length - 1].blockData.terminal
            ? null : [notchX * dir, script.measurements.height],
          inner: firstLoop && !firstLoop.components.length
            ? [firstLoop.position.x + branchWidth * dir, firstLoop.position.y]
            : null,
          firstLoop
        }
        normalInsertPath = this._dir === 'rtl'
          ? `M0 0 h${-notchLeft} ${notchToLeft} H${-script.measurements.width}`
          : `M0 0 h${notchLeft} ${notchToRight} H${script.measurements.width}`
      } else {
        snapPoints = script.components[0].getReporterAnchorPoint()
      }
    })
    return {
      move: (x, y) => {
        script.setPosition((x + dx) / this._dragScale, (y + dy) / this._dragScale)
        const elems = document.elementsFromPoint(x, y)
        let dropTargetElem
        for (let i = 0; !dropTargetElem && i < elems.length; i++) {
          dropTargetElem = elems[i].closest('[data-block-drop]')
        }
        if (dropTargetElem) {
          const dropTarget = this._dropListeners[dropTargetElem.dataset.blockDrop]
          if (possibleDropTarget !== dropTarget) {
            possibleDropTarget = dropTarget
            if (dropTarget instanceof Workspace) {
              if (type === BlockType.COMMAND) {
                if (dropTarget.getStackBlockConnections) {
                  connections = dropTarget.getStackBlockConnections()
                }
              } else {
                if (dropTarget.getReporterConnections) {
                  connections = dropTarget.getReporterConnections(script.components[0])
                }
              }
            }
            if (snapTo && snapTo instanceof Input) {
              snapTo.elem.classList.remove('block-input-drop-target')
            }
            snapTo = null
          }
          if (snapPoints && connections.length) {
            const isCloser = (connection, myConnection, closestSoFar) => {
              const myX = (script.position.x + myConnection[0]) * this._dragScale
              const myY = (script.position.y + myConnection[1]) * this._dragScale
              const { x, y } = dropTarget.scriptToCSSCoords(...connection)
              const distance = square(myX - x) + square(myY - y)
              return distance > Block.maxSnapDistance * Block.maxSnapDistance ||
                (closestSoFar && distance >= closestSoFar.distanceSquared)
                ? closestSoFar
                : {
                  distanceSquared: distance,
                  connection,
                  myConnection
                }
            }
            if (type === BlockType.COMMAND) {
              const closest = connections.reduce((closestSoFar, connection) => {
                return [
                  connection[2].beforeScript ? snapPoints.bottom : null,
                  connection[2].insertBefore ? snapPoints.inner : null,
                  // If the C block won't wrap around the block and the script
                  // isn't terminal, then use the top notch to insert before
                  (connection[2].insertBefore && !snapPoints.inner && snapPoints.bottom) ||
                    connection[2].after ? snapPoints.top : null
                ].reduce((closestSoFar, myConnection) => myConnection
                  ? isCloser(connection, myConnection, closestSoFar)
                  : closestSoFar, closestSoFar)
              }, null)
              if (closest) {
                if (snapTo !== closest.connection[2]) {
                  snapTo = closest.connection[2]
                  wrappingC = closest.myConnection === snapPoints.inner
                  if (wrappingC) {
                    spacePlaceholder.height = snapTo.in.measurements.height - snapTo.insertBefore.position.y
                    snapPoints.firstLoop.add(spacePlaceholder)
                    spacePlaceholder.resize()
                    const path = this._dir === 'rtl'
                      ? `M${-script.measurements.width} 0 H${-notchTotalWidth}` +
                        `${notchToRight} H0 V${spacePlaceholder.height}` +
                        `h${-notchLeft} ${notchToLeft} H${-script.measurements.width}`
                      : `M${script.measurements.width} 0 H${notchTotalWidth}` +
                        `${notchToLeft} H0 V${spacePlaceholder.height}` +
                        `h${notchLeft} ${notchToRight} H${script.measurements.width}`
                    snapMarker.setAttributeNS(null, 'd', path)
                  } else {
                    if (spacePlaceholder.parent) {
                      spacePlaceholder.parent.remove(spacePlaceholder)
                      snapPoints.firstLoop.resize()
                    }
                    snapMarker.setAttributeNS(null, 'd', normalInsertPath)
                  }
                  snapTo.in.elem.appendChild(snapMarker)
                  const y = snapTo.after ? snapTo.in.measurements.height
                    : snapTo.insertBefore.position.y
                  snapMarker.setAttributeNS(null, 'transform', `translate(0, ${y})`)
                }
              } else if (snapTo) {
                snapTo = null
                wrappingC = false
                if (spacePlaceholder.parent) {
                  spacePlaceholder.parent.remove(spacePlaceholder)
                  snapPoints.firstLoop.resize()
                }
                if (snapMarker.parentNode) {
                  snapMarker.parentNode.removeChild(snapMarker)
                }
              }
            } else {
              const closest = connections.reduce((closestSoFar, connection) =>
                isCloser(connection, snapPoints, closestSoFar), null)
              if (closest) {
                if (snapTo !== closest.connection[2]) {
                  if (snapTo) {
                    snapTo.elem.classList.remove('block-input-drop-target')
                  }
                  snapTo = closest.connection[2]
                  snapTo.elem.classList.add('block-input-drop-target')
                }
              } else if (snapTo) {
                snapTo.elem.classList.remove('block-input-drop-target')
                snapTo = null
              }
            }
          }
        } else if (possibleDropTarget) {
          possibleDropTarget = null
          connections = []
          if (snapTo && snapTo instanceof Input) {
            snapTo.elem.classList.remove('block-input-drop-target')
          }
          snapTo = null
          wrappingC = false
          if (spacePlaceholder.parent) {
            spacePlaceholder.parent.remove(spacePlaceholder)
            snapPoints.firstLoop.resize()
          }
          if (snapMarker.parentNode) {
            snapMarker.parentNode.removeChild(snapMarker)
          }
        }
      },
      end: () => {
        if (spacePlaceholder.parent) {
          spacePlaceholder.parent.remove(spacePlaceholder)
          // Should the parent be resized?
        }
        if (snapMarker.parentNode) {
          snapMarker.parentNode.removeChild(snapMarker)
        }
        if (snapTo && snapTo instanceof Input) {
          snapTo.elem.classList.remove('block-input-drop-target')
        }
        this._dragging--
        if (!this._dragging) {
          document.body.classList.remove('block-dragging-blocks')
        }
        this._dragWrapper.removeChild(script.elem)
        if (possibleDropTarget) {
          if (possibleDropTarget instanceof Workspace) {
            const { x, y } = script.position
            undoEntry.b = possibleDropTarget.dropBlocks({
              script,
              x: x * this._dragScale,
              y: y * this._dragScale,
              snapTo,
              wrappingC
            })
          } else if (possibleDropTarget.acceptScript) {
            possibleDropTarget.acceptScript(script)
          }
        }
        if (!undoEntry.b) {
          // TODO: This should just send it back to its original position.
          undoEntry.b = script.toJSON().blocks
        }
        const extraSteps = this._shoveTarget(undoEntry.b, script)
        this.addUndoEntry(extraSteps ? [...extraSteps, undoEntry] : undoEntry)
      }
    }
  }

  /**
   * This gets the target from the given data, displacing it from its original
   * home if necessary.
   * @param {number} blockCount - Maximum number of blocks to take (for
   *   taking from within a stack - required)
   * @returns {Script}
   */
  _grabTarget (data, blockCount = 0) {
    if (Array.isArray(data)) {
      // Is an array of block JSONs (implying it is a concept to be realized)
      const script = this.scriptFromJSON({ x: 0, y: 0, blocks: data })
      script.resize()
      return script
    } else if (data.indices) {
      // Probably means the block was dragged out from a script such that the
      // old script still remains.
      const { component, index } = getComponentFromIndices(data.indices)
      const script = this.createScript()
      if (component instanceof Input) {
        const block = component.getValue()
        if (!(block instanceof Block)) {
          throw new Error('hwat. Indices point to an input that does not hold a block.')
        }
        component.insertBlock(null)
        component.resize()
        script.add(block)
        return script
      } else {
        // `component` now is the block that is clicked on to drag out, so
        // it and its younger siblings will be deported. Not all though if this
        // is a reverse of block stack insertion.
        const parent = component.parent
        const { dx = 0, dy = 0 } = data
        const { x, y } = parent.position
        // Subtraction because this is actually the inverse of the normal operation
        // which is done in the shove step.
        parent.setPosition(x - dx, y - dy)
        let i = 0
        if (data.branchAround) {
          const branch = component.getParamComponent(data.branchAround)
          // Move branch contents outside right above the branch
          // (this is done first to prevent a parent script from self-destructing)
          while (branch.components[0]) {
            const component = branch.components[0]
            branch.remove(component)
            parent.add(component, index + i)
            i++
          }
          branch.resize()
        }
        let blocks = 0
        // Store the blocks at the given index into the carrier script
        // Takes all the blocks after that point or only the given number
        // of blocks (`blockCount`).
        while (blocks < blockCount) {
          const component = parent.components[index + i]
          if (!component) break
          parent.remove(component)
          script.add(component)
          blocks++
        }
        parent.resize()
        return script
      }
    } else if (data.workspace) {
      // An entire script in a workspace
      const script = data.workspace.scripts[data.index]
      script.removeFromWorkspace()
      return script
    } else {
      throw new Error('wucky: Given `data` no make sense!')
    }
  }

  /**
   * Intended to be the reverse of whatever is done in `_grabTarget`
   */
  _shoveTarget (data, script) {
    if (Array.isArray(data)) {
      script.destroy()
    } else if (data.indices) {
      const { workspace, parent, component, index } = getComponentFromIndices(data.indices)
      if (component instanceof Input) {
        let undoEntry
        const oldValue = component.getValue()
        if (oldValue instanceof Block) {
          // NOTE: Scratch puts it on the right of the script, vertically
          // in the middle. (That is not done here)
          const offset = inputRenderOptions.popOutOffset
          const { x, y } = oldValue.getWorkspaceOffset()
          undoEntry = {
            type: 'transfer',
            a: {
              indices: getIndicesOf(oldValue)
            },
            b: {
              workspace,
              index: workspace.scripts.length,
              x: x + offset,
              y: y + offset
            }
          }
          // This is a separate step, but it shall be grouped with this step.
          this._executeEntry(undoEntry)
        }
        component.insertBlock(script.components[0])
        component.resize()
        // Destroy the rest of the blocks in case the reporter
        // had blocks connected to it. This is not undoable because this
        // is not intended to happen.
        if (script.components.length) {
          script.destroy()
        }
        return undoEntry && [undoEntry]
      } else {
        // Shift target script
        const { dx = 0, dy = 0 } = data
        const { x, y } = parent.position
        parent.setPosition(x + dx, y + dy)
        const firstBlock = script.components[0]
        // Inserts all of the blocks in the carrier script into the target
        // stack
        let i = 0
        while (script.components.length) {
          const block = script.components[0]
          script.remove(block)
          parent.add(block, index + i)
          i++
        }
        const prom = Promise.resolve().then(() => parent.resize())
        if (data.branchAround) {
          const branch = firstBlock.getParamComponent(data.branchAround)
          // Insert all the blocks after the insert point that were already in the
          // target stack in the branch block
          while (parent.components[index + i]) {
            branch.add(parent.components[index + i])
          }
          // Ensure that the parent's other children are measured first
          prom.then(() => branch.resize())
        }
      }
    } else if (data.workspace) {
      script.setPosition(data.x, data.y)
      data.workspace.add(script, data.index)
    } else {
      throw new Error('wucky: Given `data` no make sense!')
    }
  }

  addUndoEntry (entry) {
    this._redoHistory = []
    this._undoHistory.push(entry)
    this.trigger('undo-redo-available', this._undoHistory.length, this._redoHistory.length)
  }

  _executeEntry (entry, flip = false) {
    const a = flip ? entry.b : entry.a
    const b = flip ? entry.a : entry.b
    switch (entry.type) {
      case 'transfer': {
        this._shoveTarget(b, this._grabTarget(a, entry.blocks))
        break
      }
      default:
        throw new Error(`hwat is this ${entry.type} undo entry??`)
    }
  }

  undo () {
    const entry = this._undoHistory.pop()
    if (Array.isArray(entry)) {
      // Loop backwards in a group of steps for undo
      for (let i = entry.length; i--;) {
        this._executeEntry(entry[i], true)
      }
    } else {
      this._executeEntry(entry, true)
    }
    this._redoHistory.push(entry)
    this.trigger('undo-redo-available', this._undoHistory.length, this._redoHistory.length)
  }

  redo () {
    const entry = this._redoHistory.pop()
    if (Array.isArray(entry)) {
      for (const step of entry) {
        this._executeEntry(step, false)
      }
    } else {
      this._executeEntry(entry, false)
    }
    this._undoHistory.push(entry)
    this.trigger('undo-redo-available', this._undoHistory.length, this._redoHistory.length)
  }

  updateRects () {
    for (const workspace of this._workspaces) {
      workspace.updateRect()
    }
  }

  resizeAll () {
    return Promise.all(this._workspaces.map(workspace => workspace.resizeAll(true)))
  }

  createPaletteWorkspace (wrapper, initBlockOrder) {
    const workspace = new PaletteWorkspace(this, wrapper, initBlockOrder)
    this._workspaces.push(workspace)
    return workspace
  }

  createScriptsWorkspace (wrapper) {
    const workspace = new ScriptsWorkspace(this, wrapper)
    this._workspaces.push(workspace)
    return workspace
  }

  createScript (initBlocks) {
    return new Script(this, initBlocks)
  }

  createBlock (initBlock, initParams) {
    return new Block(this, initBlock, initParams)
  }

  scriptFromJSON ({ x, y, blocks }) {
    const script = this.createScript(blocks.map(data => this.blockFromJSON(data)))
    script.setPosition(x, y)
    return script
  }

  blockFromJSON ({ opcode, params }) {
    return this.createBlock(opcode, params)
  }
}

Blocks.BlockType = BlockType
Blocks.ArgumentType = ArgumentType

Blocks.blockRenderOptions = Block.renderOptions
Blocks.inputRenderOptions = inputRenderOptions
Blocks.paletteRenderOptions = paletteRenderOptions

export { Blocks }
