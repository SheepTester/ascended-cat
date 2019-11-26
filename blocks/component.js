import { Elem } from '../utils/elem.js'
import { Newsletter } from '../utils/newsletter.js'

class GenericComponent extends Newsletter {
  constructor () {
    super()
    this.measurements = null
    this._position = { x: 0, y: 0 }
    this._visible = true
  }

  get visible () {
    return this._visible
  }

  set visible (visible) {
    if (visible) {
      this.elem.classList.remove('block-hidden')
    } else {
      this.elem.classList.add('block-hidden')
    }
    this._visible = visible
  }

  /**
   * Called to reposition components when sizes are updated. This will update
   * its own `measurements`.
   */
  reposition () {
    this.measurements = { width: 0, height: 0 }
  }

  get position () {
    return this._position
  }

  setPosition (x, y) {
    this._position = { x, y }
    this.elem.setAttributeNS(null, 'transform', `translate(${x}, ${y})`)
    this.trigger('position-change', x, y)
  }

  storeAllInputsIn (arr) {
    //
  }

  /**
   * Does not take into account scrolling.
   */
  getWorkspaceOffset () {
    const { x, y } = this.position
    if (this.parent) {
      const { x: px, y: py } = this.parent.getWorkspaceOffset()
      return { x: px + x, y: py + y }
    } else {
      return { x, y }
    }
  }

  getWorkspace () {
    let parent = this
    while (parent && !parent.workspace) {
      parent = parent.parent
    }
    return parent.workspace
  }
}

class TextComponent extends GenericComponent {
  constructor (initText) {
    super()
    this.elem = Elem('text', { class: 'block-text-component' }, [], true)
    if (initText) this.text = initText
  }

  get text () {
    return this.elem.textContent
  }

  set text (text) {
    this.elem.textContent = text
    this.measurements = null
  }

  /**
   * Calculates the width and height of the text.
   * @param {boolean} [force] - Whether everything should be remeasured regardless
   * @param {boolean} [repositionParents] - Whether the ancestors should be
   *  repositioned after the size is calculated.
   * @returns {Promise.<Measurements>} - The new measurements.
   */
  resize (force = false, repositionParents = true) {
    return new Promise(resolve => {
      window.requestAnimationFrame(() => {
        const rect = this.elem.getBBox()
        // `height` is zero so a Block centres it right in the middle, allowing
        // the `dominant-baseline` to deal with centring.
        this.measurements = { width: rect.width, height: rect.height }
        if (repositionParents) {
          let parent = this.parent
          while (parent) {
            parent.reposition()
            parent = parent.parent
          }
        }
        resolve(this.measurements)
      })
    })
  }

  destroy () {
    if (this.parent) {
      throw new Error('Component cannot be destroyed in plain sight.')
    }
    this.elem = null
  }
}

class Component extends GenericComponent {
  constructor () {
    super()
    this.elem = Elem('g', { class: 'block-component' }, [], true)
    this.components = []
  }

  add (component, beforeIndex = this.components.length) {
    if (component.parent) {
      component.parent.remove(component)
    }
    if (beforeIndex < this.components.length) {
      this.elem.insertBefore(component.elem, this.components[beforeIndex].elem)
    } else {
      this.elem.appendChild(component.elem)
    }
    this.components.splice(beforeIndex, 0, component)
    component.parent = this
    component.trigger('added', this)
    return component
  }

  remove (component) {
    component.trigger('removing', this)
    const index = this.components.indexOf(component)
    if (~index) {
      this.components.splice(index, 1)
    }
    this.elem.removeChild(component.elem)
    component.parent = null
  }

  clear () {
    for (const component of this.components) {
      this.elem.removeChild(component.elem)
      component.parent = null
    }
    this.components.splice(0, this.components.length)
  }

  /**
   * Call this when components are added; will make sure each child
   * has measurements before repositioning each of them accordinging and
   * saving its new size.
   */
  async resize (force = false, repositionParents = true) {
    await Promise.all(this.components.map(component => {
      if (!component.measurements || force) {
        return component.resize(force, false)
      }
    }))
    this.reposition()
    if (repositionParents) {
      let parent = this.parent
      while (parent) {
        parent.reposition()
        parent = parent.parent
      }
    }
  }

  storeAllInputsIn (arr) {
    for (const component of this.components) {
      component.storeAllInputsIn(arr)
    }
  }

  /**
   * This is not suicide; this is the obliteration of the SELF.
   */
  destroy () {
    if (this.parent) {
      throw new Error('Component cannot be destroyed in plain sight.')
    }
    while (this.components[0]) {
      const component = this.components[0]
      this.remove(component)
      component.destroy()
    }
    this.elem = null
  }
}

class Space extends Component {
  constructor (height = 0) {
    super()
    this.height = height
  }

  reposition () {
    this.measurements = { width: 0, height: this.height }
    this.trigger('reposition', this.measurements)
  }
}

export { TextComponent, Component, Space }
