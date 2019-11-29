import { Elem } from '../utils/elem.js'
import { square } from '../utils/math.js'
import { Newsletter } from '../utils/newsletter.js'

import { ScriptsWorkspace } from './workspace.js'
import { PaletteWorkspace, paletteRenderOptions } from './palette.js'
import { BlockType, ArgumentType } from './constants.js'
import { Stack, Script } from './scripts.js'
import { Block } from './block.js'
import { Space } from './component.js'
import { Input } from './input.js'

class Blocks extends Newsletter {
  constructor (initCategories) {
    super()

    this._language = null
    this._dir = 'ltr'
    this.translations = { default: {} }
    this.categories = {}
    for (const category of initCategories) {
      this.addCategory(category)
    }

    this.clickListeners = {}
    this.dragListeners = {}
    this.dropListeners = {}
    this._workspaces = []

    this._dragSvg = Elem('svg', { class: 'block-dragged' }, [], true)
    document.body.appendChild(this._dragSvg)
    this._dragging = 0
  }

  addCategory ({
    id,
    name = `Category ${id}`,
    blocks = [],
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
  }

  addBlock (category, {
    opcode,
    blockType = BlockType.COMMAND,
    text = `block ${opcode}`,
    hat = false,
    terminal = false,
    arguments: args = {}
    // func, filter, menus?
  }) {
    const blockOpcode = `${category}.${opcode}`
    this.translations.default[blockOpcode] = text
    this.categories[category][opcode] = {
      blockType,
      hat,
      terminal,
      args
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
      this.translations[this._language][id]) {
      return this.translations[this._language][id]
    }
    return this.translations.default[id] || '???'
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
    const id = ++Blocks._id
    this.clickListeners[id] = fn
    elem.dataset.blockClick = id
  }

  onDrag (elem, fn) {
    const id = ++Blocks._id
    this.dragListeners[id] = fn
    elem.dataset.blockDrag = id
  }

  onDrop (elem, listeners) {
    const id = ++Blocks._id
    this.dropListeners[id] = listeners
    elem.dataset.blockDrop = id
  }

  removeListeners (elem) {
    delete this.clickListeners[elem.dataset.blockClick]
    delete this.dragListeners[elem.dataset.blockDrag]
    delete this.dropListeners[elem.dataset.blockDrop]
    return 'Have a nice day!'
  }

  dragBlocks ({ target, initMouseX, initMouseY, scriptX, scriptY, type }) {
    if (!this._dragging) {
      document.body.classList.add('block-dragging-blocks')
    }
    this._dragging++
    const script = this.grabTarget(target, Infinity)
    script.setPosition(scriptX, scriptY)
    this._dragSvg.appendChild(script.elem)
    const dx = initMouseX - scriptX
    const dy = initMouseY - scriptY
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
        script.setPosition(x - dx, y - dy)
        const elems = document.elementsFromPoint(x, y)
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
                connections = dropTarget.getReporterConnections(script.components[0])
              }
            }
            if (snapTo && snapTo instanceof Input) {
              snapTo.elem.classList.remove('block-input-drop-target')
            }
            snapTo = null
          }
          if (snapPoints && connections.length) {
            const workspaceRect = dropTarget.getRect()
            const { left, top } = dropTarget.getTransform()
            if (type === BlockType.COMMAND) {
              const closest = connections.reduce((closestSoFar, connection) => {
                return [
                  connection[2].beforeScript ? snapPoints.bottom : null,
                  connection[2].insertBefore ? snapPoints.inner : null,
                  // If the C block won't wrap around the block and the script
                  // isn't terminal, then use the top notch to insert before
                  (connection[2].insertBefore && !snapPoints.inner && snapPoints.bottom) ||
                    connection[2].after ? snapPoints.top : null
                ].reduce((closestSoFar, myConnection) => {
                  if (!myConnection) return closestSoFar
                  const myX = script.position.x + myConnection[0]
                  const myY = script.position.y + myConnection[1]
                  const connectionX = workspaceRect.x + connection[0] - left
                  const connectionY = workspaceRect.y + connection[1] - top
                  const distance = square(myX - connectionX) +
                    square(myY - connectionY)
                  if (distance > Block.maxSnapDistance * Block.maxSnapDistance ||
                    (closestSoFar && distance >= closestSoFar.distanceSquared)) {
                    return closestSoFar
                  } else {
                    return {
                      distanceSquared: distance,
                      connection,
                      myConnection
                    }
                  }
                }, closestSoFar)
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
              const closest = connections.reduce((closestSoFar, connection) => {
                const myX = script.position.x + snapPoints[0]
                const myY = script.position.y + snapPoints[1]
                const connectionX = workspaceRect.x + connection[0] - left
                const connectionY = workspaceRect.y + connection[1] - top
                const distance = square(myX - connectionX) +
                  square(myY - connectionY)
                if (distance > Block.maxSnapDistance * Block.maxSnapDistance ||
                  (closestSoFar && distance >= closestSoFar.distanceSquared)) {
                  return closestSoFar
                } else {
                  return {
                    distanceSquared: distance,
                    connection
                  }
                }
              }, null)
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
        this._dragSvg.removeChild(script.elem)
        if (possibleDropTarget && possibleDropTarget.acceptDrop) {
          const { x, y } = script.position
          possibleDropTarget.acceptDrop(
            script,
            x,
            y,
            snapTo,
            wrappingC,
            undoEntry
          )
        } else {
          undoEntry.b = script.toJSON().blocks
          script.destroy()
        }
        console.log(undoEntry)
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
  grabTarget (data, blockCount = 0) {
    if (Array.isArray(data)) {
      // Is an array of block JSONs (implying it is a concept to be realized)
      return this.scriptFromJSON({ x: 0, y: 0, blocks: data })
    } else if (data.indices) {
      // Probably means the block was dragged out from a script such that the
      // old script still remains.
      const [workspace, scriptIndex, ...indices] = data.indices
      let component = workspace.scripts[scriptIndex]
      for (const index of indices) {
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
        const index = indices[indices.length - 1]
        let blocks = 0
        while (blocks < blockCount) {
          const component = parent.components[index]
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
      // Should we store x/y position here? Nah
      return script
    } else {
      throw new Error('wucky: Given `data` no make sense!')
    }
  }

  /**
   * Intended to be the reverse of whatever is done in `grabTarget`
   */
  shoveTarget (data, script) {
    if (Array.isArray(data)) {
      script.destroy()
    } else if (data.indices) {
      const [workspace, script, ...indices] = data.indices
      let component = workspace.scripts[script]
      for (const index of indices) {
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
      if (component instanceof Input) {
        const oldValue = component.getValue()
        if (oldValue instanceof Block) {
          // TODO: another undo entry for popping out a block??
          // NOTE: Scratch puts it on the right of the script, vertically
          // in the middle. (That is not done here)
          const offset = Input.renderOptions.popOutOffset
          const { x, y } = oldValue.getWorkspaceOffset()
          component.insertBlock(null)
          const script = this.createScript()
          script.setPosition(x + offset, y + offset)
          script.add(oldValue)
          workspace.add(script)
          script.resize()
        }
        script.remove(script.components[0])
        component.insertBlock(script.components[0])
        component.resize()
        // Destroy the rest of the blocks in case the reporter
        // had blocks connected to it.
        // TODO: another undo entry for this as well? and how?
        if (script.components.length) {
          script.destroy()
        }
      } else {
        const parent = component.parent
        let index = indices[indices.length - 1]
        while (script.components.length) {
          const block = script.components[0]
          script.remove(block)
          parent.add(block, index)
          index++
        }
        parent.resize()
      }
    } else if (data.workspace) {
      script.setPosition(data.x, data.y)
      data.workspace.add(script, data.index)
    } else {
      throw new Error('wucky: Given `data` no make sense!')
    }
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

Blocks._id = 0

Blocks.BlockType = BlockType
Blocks.ArgumentType = ArgumentType

Blocks.blockRenderOptions = Block.renderOptions
Blocks.inputRenderOptions = Input.renderOptions
Blocks.paletteRenderOptions = paletteRenderOptions

export { Blocks }
