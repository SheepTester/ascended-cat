// Relies on blocks/workspace, blocks/scripts, blocks/block, blocks/constants

/**
 * Issues:
 * - Cannot add blocks to an existing category
 * - Should be able to get a category or block using a method
 */

class Blocks {
  constructor (initCategories) {
    this.categories = []
    for (const category of initCategories) {
      this.addCategory(category)
    }
  }

  addCategory (category) {
    this.categories.push(category)
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
