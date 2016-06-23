# fs-sandbox

A wrapper around the node `fs` module, used in the [Beaker Browser](https://github.com/pfraze/beaker) to give sandboxed access to files and folders.

## Usage

```js
var fs = require('fs')
var fss = require('fs-sandbox')

// create a folder sandboxed to `path`
var folder = fss.createFolderSandbox(path)

// api:
// (all *Sync variants are supported)
folder.appendFile(path, data[, options], callback)
folder.exists(path, callback)
folder.mkdir(path, callback)
folder.open(path[, flags], callback)
folder.readdir(path[, options], callback)
folder.readFile(path[, options], callback)
folder.rename(oldPath, newPath, callback)
folder.rmdir(path, callback)
folder.stat(path, callback)
folder.unlink(path, callback)
folder.writeFile(file, data[, options], callback)

// open a file sandboxed to a path
var file = fss.createFileSandbox(path + '/myfile.txt', fs.openSync(path + '/myfile.txt', 'w+'))
// or...
var file = folder.openSync('./myfile.txt', 'w+')

// api:
// (all *Sync variants are supported)
file.appendFile(data[, options], callback)
file.close(cb)
file.read(buffer, offset, length, position, callback)
file.readFile([options,] callback)
file.stat(cb)
file.sync(cb)
file.truncate(len, cb)
file.unlink(cb)
file.write(buffer, offset, length[, position], callback)
file.write(data[, position[, encoding]], callback)
file.writeFile(data[, options], callback)
```

## Disabled methods

Most `fs` methods are included.
These are not:

 * access
 * chmod
 * chown
 * createReadStream
 * createWriteStream
 * fchmod
 * fchown
 * fdatasync
 * futimes
 * ftruncate
 * ftruncateSync
 * lchmod
 * lchown
 * link
 * mkdtemp
 * readlink
 * realpath
 * symlink
 * unwatchFile
 * utimes
 * watch
 * watchFile

 Also, the methods are not allowed to set the permission mode bits.