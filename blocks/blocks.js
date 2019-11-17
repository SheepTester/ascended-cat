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

  createPaletteWorkspace (wrapper) {
    return new PaletteWorkspace(this, wrapper)
  }

  createWorkspace (wrapper) {
    return new Workspace(this, wrapper)
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
