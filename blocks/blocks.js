// Relies on blocks/workspace, blocks/scripts, blocks/block, blocks/constants,
// utils/math, blocks/component, utils/elem
import {Elem} from '../utils/elem.js'
import {square} from '../utils/math.js'
import {Newsletter} from '../utils/newsletter.js'

import {Workspace, PaletteWorkspace} from './workspace.js'
import {BlockType, ArgumentType} from './constants.js'
import {Stack, Script} from './scripts.js'
import {Block} from './block.js'
import {Space} from './component.js'
import {Input} from './input.js'

class Blocks extends Newsletter {
  constructor (initCategories) {
    super()

    this._language = null
    this.translations = {default: {}}
    this.categories = {}
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

  addCategory ({
    id,
    name = `Category ${id}`,
    blocks = [],
    translationMap = {}
  }) {
    this.categories[id] = {}
    this.translations.default[id] = name
    // TODO: Fix or redesign separators, somehow.
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
    arguments: args = {},
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
    return Promise.all(this._workspaces.map(workspace => workspace.resizeAll(true)))
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
    if (this._language && this.translations[this._language]
      && this.translations[this._language][id]) {
      return this.translations[this._language][id]
    }
    return this.translations.default[id]
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
    let possibleDropTarget, connections = [], snapPoints, snapTo, wrappingC = false
    const spacePlaceholder = new Space()
    const snapMarker = Elem('path', {class: 'block-snap-marker'}, [], true)
    const {notchLeft, notchTotalWidth, notchToLeft, notchToRight} = Block.renderOptions
    let normalInsertPath
    onReady.then(() => {
      const {notchX, branchWidth} = Block.renderOptions
      if (type === BlockType.COMMAND) {
        const firstLoop = script.components[0].components
          .find(component => component instanceof Stack)
        snapPoints = {
          top: script.components[0].blockData.hat ? null : [notchX, 0],
          bottom: script.components[script.components.length - 1].blockData.terminal
            ? null : [notchX, script.measurements.height],
          inner: firstLoop && !firstLoop.components.length
            ? [firstLoop.position.x + branchWidth, firstLoop.position.y]
            : null,
          firstLoop
        }
        normalInsertPath = `M0 0 h${notchLeft} ${notchToRight} H${script.measurements.width}`
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
            const {left, top} = dropTarget.getTransform()
            if (type === BlockType.COMMAND) {
              const closest = connections.reduce((closestSoFar, connection) => {
                return [
                  connection[2].beforeScript ? snapPoints.bottom : null,
                  connection[2].insertBefore ? snapPoints.inner : null,
                  // If the C block won't wrap around the block and the script
                  // isn't terminal, then use the top notch to insert before
                  connection[2].insertBefore && !snapPoints.inner && snapPoints.bottom
                    || connection[2].after ? snapPoints.top : null
                ].reduce((closestSoFar, myConnection) => {
                  if (!myConnection) return closestSoFar
                  const myX = script.position.x + myConnection[0]
                  const myY = script.position.y + myConnection[1]
                  const connectionX = workspaceRect.x + connection[0] - left
                  const connectionY = workspaceRect.y + connection[1] - top
                  const distance = square(myX - connectionX)
                    + square(myY - connectionY)
                  if (distance > Block.maxSnapDistance * Block.maxSnapDistance
                    || closestSoFar && distance >= closestSoFar.distanceSquared) {
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
                    let path = `M${script.measurements.width} 0 H${notchTotalWidth}`
                      + `${notchToLeft} H0 V${spacePlaceholder.height}`
                      + `h${notchLeft} ${notchToRight} H${script.measurements.width}`
                    snapMarker.setAttributeNS(null, 'd', path)
                  } else {
                    if (spacePlaceholder.parent) {
                      spacePlaceholder.parent.remove(spacePlaceholder)
                      snapPoints.firstLoop.resize()
                    }
                    snapMarker.setAttributeNS(null, 'd', normalInsertPath)
                  }
                  snapTo.in.elem.appendChild(snapMarker)
                  let y = snapTo.after ? snapTo.in.measurements.height
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
                const distance = square(myX - connectionX)
                  + square(myY - connectionY)
                if (distance > Block.maxSnapDistance * Block.maxSnapDistance
                  || closestSoFar && distance >= closestSoFar.distanceSquared) {
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
          const {x, y} = script.position
          possibleDropTarget.acceptDrop(
            script,
            x,
            y,
            snapTo,
            wrappingC
          )
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

  scriptFromJSON ({x, y, blocks}) {
    const script = this.createScript(blocks.map(data => this.blockFromJSON(data)))
    script.setPosition(x, y)
    return script
  }

  blockFromJSON ({opcode, params}) {
    return this.createBlock(opcode, params)
  }
}

Blocks._id = 0

Blocks.BlockType = BlockType

Blocks.ArgumentType = ArgumentType

export {Blocks}
