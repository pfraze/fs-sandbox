var fs = require("fs");
var Path = require("path");

/**
 * FD-based methods are guarded by open(), so they're a simple whitelist
 **/
const ALLOWED_FD_METHODS = [
    "truncate",
    "fchown",
    "fchmod",
    "fstat",
    "close",
    "futimes",
    "fsync",
    "write",
    "read"
]

/**
 * Path-based methods require specific args to be guarded.
 **/
const ALLOWED_PATH_METHODS = [
    { name: "rename",     guardedArgs: [0, 1], callbackArgs: [2]    },
    { name: "chown",      guardedArgs: [0],    callbackArgs: [3]    },
    { name: "chmod",      guardedArgs: [0],    callbackArgs: [2]    },
    { name: "stat",       guardedArgs: [0],    callbackArgs: [1]    },
    { name: "lstat",      guardedArgs: [0],    callbackArgs: [1]    },
    { name: "link",       guardedArgs: [0, 1], callbackArgs: [2]    },
    { name: "symlink",    guardedArgs: [0, 1], callbackArgs: [2, 3] },
    { name: "readlink",   guardedArgs: [0],    callbackArgs: [1]    },
    { name: "realpath",   guardedArgs: [0],    callbackArgs: [2, 3] },
    { name: "unlink",     guardedArgs: [0],    callbackArgs: [1]    },
    { name: "rmdir",      guardedArgs: [0],    callbackArgs: [1]    },
    { name: "mkdir",      guardedArgs: [0],    callbackArgs: [1, 2] },
    { name: "readdir",    guardedArgs: [0],    callbackArgs: [1]    },
    { name: "open",       guardedArgs: [0],    callbackArgs: [2, 3] },
    { name: "utimes",     guardedArgs: [0],    callbackArgs: [3]    },
    { name: "readFile",   guardedArgs: [0],    callbackArgs: [1, 2] },
    { name: "writeFile",  guardedArgs: [0],    callbackArgs: [2, 3] },
    { name: "appendFile", guardedArgs: [0],    callbackArgs: [2, 3] },
    { name: "exists",     guardedArgs: [0],    callbackArgs: [1]    }
]

/**
 * Currently disallowed:
 *
 * fs.access(path[, mode], callback)
 * fs.createReadStream(path[, options])
 * fs.createWriteStream(path[, options])
 * fs.fdatasync(fd, callback)
 * fs.ftruncate(fd, len, callback)
 * fs.ftruncateSync(fd, len)
 * fs.lchmod(path, mode, callback)
 * fs.lchown(path, uid, gid, callback)
 * fs.mkdtemp(prefix, callback)
 * fs.watch(filename[, options][, listener])
 * fs.watchFile(filename[, options], listener)
 * fs.unwatchFile(filename[, listener])
 **/

function makeMatcher(paths) {
    var regexps = paths.map(function (path) {
        return new RegExp("^" + path);
    });

    return function (path) {
        return regexps.some(function (rx) { return rx.test(path) });
    }
}

module.exports = {
    createWhitelisted: function (filters) {
        var matcher = makeMatcher(filters);
        var filterer = function (path) { return matcher(path); };
        return module.exports.create(filterer);
    },

    createBlacklisted: function (filters) {
        var matcher = makeMatcher(filters);
        var filterer = function (path) { return !matcher(path); };
        return module.exports.create(filterer);
    },

    create: function (filterer) {
        var module = {};

        // All file descriptor APIs are safe.
        ALLOWED_FD_METHODS.forEach(function (method) {
            if (!fs[method]) throw new Error("fs does not have method '" + method + "'.");
            module[method] = fs[method].bind(fs);

            // All file descriptor APIs also hve a 'sync' version.
            method = method + "Sync";
            if (!fs[method]) throw new Error("fs does not have method '" + method + "'.");
            module[method] = fs[method].bind(fs);
        });

        // Path APIs needs to be guarded.
        ALLOWED_PATH_METHODS.forEach(function (spec) {
            module[spec.name] = makeGuardedFsMethod(
                spec.name,
                spec.guardedArgs,
                filterer,
                function (err, providedArgs) {
                    // Find the provided 'callback' if any, and pass the
                    // sandbox error to the callback as the first argument.
                    var cbIdx = spec.callbackArgs.filter(function (i) {
                        return typeof(providedArgs[i]) == "function";
                    })[0];

                    var cb = providedArgs[cbIdx];
                    cb && cb(err);
                });

            // They all have a 'sync' version.
            module[spec.name + "Sync"] = makeGuardedFsMethod(
                spec.name + "Sync",
                spec.guardedArgs,
                filterer,
                function (err, providedArgs) {
                    // The synchronous APIs throws.
                    throw err;
                });
        });


        // TODO: watchFile, unwatchFile, watch

        return module;
    }
};


function makeGuardedFsMethod(method, guardedArgs, filterer, errorHandler) {
    return function () {
        for (var i = 0, ii = guardedArgs.length; i < ii; i++) {
            // Argument might be optional, ignore if not present.
            if (!(i in arguments)) return;

            // Error if the argument is not matching the filterer.
            var path = arguments[i];
            var normalizedPath = Path.normalize(path);

            if (!filterer(normalizedPath)) {
                var err = new Error("ENOENT");
                err.code = "ENOENT";
                err.errno = 34;
                err.path = path;
                errorHandler(err, arguments);
                return;
            }
        };

        return fs[method].apply(fs, arguments);
    };
}
