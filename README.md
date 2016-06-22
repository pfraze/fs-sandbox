# fs-sandbox

Forked from [nodejs-sandboxed-fs](https://github.com/augustl/nodejs-sandboxed-fs), by August Lilleaas.

Identical API to the core `fs` module, but allows for whitelisting and blacklisting of certain paths. Can be used to provide sandboxed file system for VM sandboxes.

## Installing

This package is proof of concept and is not published to npmjs.org.

## Usage

Will only be able to access files and folders beyond the listed paths.

    var fss = require("fs-sandbox").createWhitelisted([
        "/home/deploy/foo",
        "/tmp"
    ]);

Will not be able to access any files or folders in the specified paths.

    var fss = require("fs-sandbox").createBlacklisted([
        "/var",
        "/home"
    ]);

The `fss` can then be used as a normal fs module, with 100% core fs module API compatibility.

You probably want to use this module in a VM, like so:

    var fss = require("fs-sandbox").createWhitelisted([...]);
    var vm = require("vm");
    var ctx = {};
    ctx.require = function (module) {
        if (module === "fs") {
            return fss;
        }
        
        return require(module);
    }
    vm.runInNewContext(stringOfCode, ctx);

The `stringOfCode` will be evaluated as a normal Node.js script, but will only have the globals available that you specify in `ctx`. Here we define our own `require`, where `fs` will return our own `fss` module, or otherwise piggyback to the normal require.


## Disabled methods

All `fs` methods are included except the sync and async variants of:

 * access
 * createReadStream
 * createWriteStream
 * fdatasync
 * ftruncate
 * ftruncateSync
 * lchmod
 * lchown
 * mkdtemp
 * watch
 * watchFile
 * unwatchFile

This may change in the future.