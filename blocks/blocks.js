// Relies on blocks/workspace.js

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
}

Blocks.BlockType = {
  BOOLEAN: 'boolean',
  COMMAND: 'command',
  REPORTER: 'reporter'
}

Blocks.ArgumentType = {
  STRING: 'string',
  NUMBER: 'number',
  ANGLE: 'angle',
  BOOLEAN: 'boolean',
  COLOUR: 'colour'
}
