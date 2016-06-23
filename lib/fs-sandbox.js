var fs = require("fs")
var Path = require("path")

// globals
// =

const FOLDER_METHODS = [
  { name: 'appendFile', guardedArgs: [0],    callbackArgs: [2, 3], argFilter: appendFileArgsFilter },
  { name: 'exists',     guardedArgs: [0],    callbackArgs: [1]    },
  { name: 'mkdir',      guardedArgs: [0],    callbackArgs: [1, 2], argFilter: mkdirArgsFilter },
  { name: 'open',       guardedArgs: [0],    callbackArgs: [2, 3], argFilter: openArgsFilter },
  { name: 'readdir',    guardedArgs: [0],    callbackArgs: [1]    },
  { name: 'readFile',   guardedArgs: [0],    callbackArgs: [1, 2] },
  { name: 'rename',     guardedArgs: [0, 1], callbackArgs: [2]    },
  { name: 'rmdir',      guardedArgs: [0],    callbackArgs: [1]    },
  { name: 'stat',       guardedArgs: [0],    callbackArgs: [1]    },
  { name: 'unlink',     guardedArgs: [0],    callbackArgs: [1]    },
  { name: 'writeFile',  guardedArgs: [0],    callbackArgs: [2, 3], argFilter: writeFileArgsFilter }
]

const FILE_METHODS = [
  { name: 'appendFile', type: 'path' },
  { name: 'close',      type: 'fd' },
  { name: 'read',       type: 'fd' },
  { name: 'readFile',   type: 'path' },
  { name: 'stat',       type: 'fd' },
  { name: 'sync',       type: 'fd' },
  { name: 'truncate',   type: 'fd' },
  { name: 'unlink',     type: 'path' },
  { name: 'write',      type: 'fd' },
  { name: 'writeFile',  type: 'path' }
]

// exports
// =

module.exports.createFolderSandbox = createFolderSandbox
module.exports.createFileSandbox = createFileSandbox

function createFolderSandbox (folderPath) {
  var folder = {}
  var isPathAllowed = makeMatcher(folderPath)

  // add guarded methods
  FOLDER_METHODS.forEach(function (spec) {
    // async version
    folder[spec.name] = makeFolderMethod(
      spec.name,
      spec.guardedArgs,
      folderPath,
      isPathAllowed,
      spec.argFilter,
      function (err, providedArgs) {
        // Find the provided 'callback' if any, and pass the
        // sandbox error to the callback as the first argument.
        var cbIdx = spec.callbackArgs.filter(function (i) {
          return typeof(providedArgs[i]) == "function"
        })[0]

        var cb = providedArgs[cbIdx]
        cb && cb(err)
      }
    )

    // sync version
    folder[spec.name + "Sync"] = makeFolderMethod(
      spec.name + "Sync",
      spec.guardedArgs,
      folderPath,
      isPathAllowed,
      spec.argFilter,
      function (err, providedArgs) {
        // The synchronous APIs throws.
        throw err
      }
    )
  })

  // wrap open()
  var sandboxedOpen = folder.open
  var sandboxedOpenSync = folder.openSync
  folder.open = function (path, flags, cb) {
    sandboxedOpen(path, flags, function (err, fd) {
      if (err) return cb(err)
      cb(null, createFileSandbox(fd, Path.join(folderPath, path)))
    })
  }
  folder.openSync = function (path, flags) {
    var fd = sandboxedOpenSync(path, flags)
    return createFileSandbox(fd, Path.join(folderPath, path))
  }


  return folder
}

function createFileSandbox (fd, path) {
  var file = {}

  // add bound methods
  FILE_METHODS.forEach(function (spec) {
    // file-descriptor methods
    if (spec.type == 'fd') {
      var realname = spec.name
      if (spec.name != 'read' && spec.name != 'write' && spec.name != 'close')
        realname = 'f' + spec.name // most fd methods have an 'f' in front of them

      file[spec.name] = fs[realname].bind(fs, fd)
      file[spec.name + "Sync"] = fs[realname + "Sync"].bind(fs, fd)
    }

    // path methods
    if (spec.type == 'path') {
      file[spec.name] = fs[spec.name].bind(fs, path)
      file[spec.name + "Sync"] = fs[spec.name + "Sync"].bind(fs, path)
    }
  })

  return file
}

// helpers
// =

function makeMatcher(path) {
  var rx = new RegExp("^" + path)
  return path => rx.test(path)
}

function makeFolderMethod(method, guardedArgs, folderPath, isPathAllowed, argFilter, errorHandler) {
  return function () {
    for (var i = 0, ii = guardedArgs.length; i < ii; i++) {
      // argument might be optional, ignore if not present.
      if (!(i in arguments)) return

      // enforce the sandbox
      var path = arguments[i]
      var normalizedPath = Path.resolve(folderPath, path)
      if (!isPathAllowed(normalizedPath)) {
        var err = new Error("ENOENT")
        err.code = "ENOENT"
        err.errno = 34
        err.path = path
        errorHandler(err, arguments)
        return
      }
      arguments[i] = normalizedPath
    }

    // apply arguments filter, if given
    if (argFilter)
      argFilter(arguments)

    return fs[method].apply(fs, arguments)
  }
}

function appendFileArgsFilter (args) {
  // force default mode of 666
  if (typeof args[2] == 'object')
    args[2].mode = 0o666
}

function mkdirArgsFilter (args) {
  // force default mode of 777
  if (typeof args[1] == 'number' || typeof args[1] == 'string')
    args[1] = 0o777
}

function openArgsFilter (args) {
  // force default mode of 666
  if (typeof args[2] == 'number' || typeof args[2] == 'string')
    args[2] = 0o666
}

function writeFileArgsFilter (args) {
  // force default mode of 666
  if (typeof args[2] == 'object')
    args[2].mode = 0o666
}