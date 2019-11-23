// Relies on blocks/workspace, blocks/scripts, blocks/block, blocks/constants,
// utils/math, blocks/component, utils/elem
import {Elem} from '../utils/elem.js'
import {square} from '../utils/math.js'

import {Workspace, PaletteWorkspace} from './workspace.js'
import {BlockType, ArgumentType} from './constants.js'
import {Stack, Script} from './scripts.js'
import {Block} from './block.js'
import {Space} from './component.js'
import {Input} from './input.js'

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
                  const connectionX = workspaceRect.x + connection[0]
                  const connectionY = workspaceRect.y + connection[1]
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
                const connectionX = workspaceRect.x + connection[0]
                const connectionY = workspaceRect.y + connection[1]
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
}

Blocks._id = 0

Blocks.BlockType = BlockType

Blocks.ArgumentType = ArgumentType

export {Blocks}
