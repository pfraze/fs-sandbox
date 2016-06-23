var tape = require('tape')
var Path = require('path')
var fss = require('../lib/fs-sandbox')
var corefs = require('fs')

const sandboxPath = __dirname + '/fixtures'
const existingInside = './a-file.txt'
const existingOutside = '../fs-sandbox-test.js'

tape('existingInside actually exists', t => {
    t.ok(corefs.statSync(Path.resolve(sandboxPath, existingInside)))
    t.end()
})

tape('existingOutside actually exists', t => {
    t.ok(corefs.statSync(Path.resolve(sandboxPath, existingOutside)))
    t.end()
})

tape('should call whitelisted async API that takes one argument', t => {
    var folder = fss.createFolderSandbox(sandboxPath);

    folder.stat(existingInside, function (err, stat) {
        t.notOk(err);
        t.equal(stat.size, 16);
        t.end();
    });
})

tape('should fail for whitelisted async API taking one argument', t => {
    var self = this;
    var folder = fss.createFolderSandbox(sandboxPath);

    folder.stat(existingOutside, function (err, stat) {
        t.ok(err);
        t.notOk(stat);
        assertEnoentErr(t, err, existingOutside);
        t.end()
    });
})

tape('should return for whitelisted sync API that takes one argument', t => {
    var folder = fss.createFolderSandbox(sandboxPath);

    var stat = folder.statSync(existingInside);
    t.equal(stat.size, 16);
    t.end()
})

tape('should throw for whitelisted sync API that takes one argument', t => {
    var folder = fss.createFolderSandbox(sandboxPath);

    try {
        folder.statSync(existingOutside);
    } catch(err) {
        assertEnoentErr(t, err, existingOutside);
        t.end()
    }
})

tape('first arg of async multiarg inside whitelisted sandbox', t => {
    var folder = fss.createFolderSandbox(sandboxPath);

    folder.readFile(existingInside, function (err, buf) {
        t.notOk(err);
        t.ok(buf);
        t.end()
    });
})

tape('second arg of async multiarg inside whitelisted sandbox', t => {
    var folder = fss.createFolderSandbox(sandboxPath);

    folder.readFile(existingInside, 'utf-8', function (err, str) {
        t.notOk(err);
        t.ok(str);
        t.end()
    });
})

tape('first arg of async multiarg outside whitelisted sandbox', t => {
    var self = this;
    var folder = fss.createFolderSandbox(sandboxPath);

    folder.readFile(existingOutside, function (err, buf) {
        assertEnoentErr(t, err, existingOutside);
        t.notOk(buf);
        t.end()
    });
})

tape('second arg of async multiarg outside whitelisted sandbox', t => {
    var self = this;
    var folder = fss.createFolderSandbox(sandboxPath);

    folder.readFile(existingOutside, 'utf-8', function (err, str) {
        assertEnoentErr(t, err, existingOutside);
        t.notOk(str);
        t.end()
    });
})

tape('accessing absolute path outside of sandbox', t => {
    var folder = fss.createFolderSandbox(sandboxPath);
    var absoluteOutsidePath = Path.resolve(sandboxPath, existingOutside)
    folder.readFile(absoluteOutsidePath, function (err, buf) {
        assertEnoentErr(t, err, absoluteOutsidePath);
        t.notOk(buf);
        t.end()
    });
})

tape('appendFile should always set mode (perms) to default', t => {
    var filepath = sandboxPath + '/append-file.txt'
    var folder = fss.createFolderSandbox(sandboxPath);
    
    folder.appendFileSync(filepath, 'test', { encoding: 'utf-8', mode: 0 })
    var stat = corefs.statSync(filepath)
    corefs.unlinkSync(filepath) // cleanup

    t.notEqual(stat.mode & 0o7777, 0) // hard to predict what perms will be on all machines, so lets just make sure it isnt 0
    t.end()
})

tape('writeFile should always set mode (perms) to default', t => {
    var filepath = sandboxPath + '/write-file.txt'
    var folder = fss.createFolderSandbox(sandboxPath);
    
    folder.writeFileSync(filepath, 'test', { encoding: 'utf-8', mode: 0 })
    var stat = corefs.statSync(filepath)
    corefs.unlinkSync(filepath) // cleanup

    t.notEqual(stat.mode & 0o7777, 0) // hard to predict what perms will be on all machines, so lets just make sure it isnt 0
    t.end()
})

tape('mkdir should always set mode (perms) to default', t => {
    var folderpath = sandboxPath + '/mkdir'
    var folder = fss.createFolderSandbox(sandboxPath)
    
    folder.mkdirSync(folderpath, 0)
    var stat = corefs.statSync(folderpath)
    corefs.rmdirSync(folderpath) // cleanup

    t.notEqual(stat.mode & 0o7777, 0) // hard to predict what perms will be on all machines, so lets just make sure it isnt 0
    t.end()
})

tape('file api should be scoped to given file FD and path', t => {
    var folder = fss.createFolderSandbox(sandboxPath)
    var file = folder.openSync(existingInside, 'r')
    var fileContent = corefs.readFileSync(Path.resolve(sandboxPath, existingInside), 'utf-8')

    // stat
    t.ok(file.statSync())

    // read
    var buf = Buffer.alloc(fileContent.length)
    file.readSync(buf, 0, fileContent.length, 0)
    t.equal(buf.toString('utf-8'), fileContent)

    // readFile
    t.equal(file.readFileSync('utf-8'), fileContent)

    file.closeSync()
    t.end()
})

tape('file should fail to open on nonexisting file, with r flag', t => {
    var folder = fss.createFolderSandbox(sandboxPath)
    folder.open('doesnt-exist.txt', 'r', err => {
        t.ok(err)
        t.end()
    })
})

tape('file should fail to open files outside the sandbox', t => {
    var folder = fss.createFolderSandbox(sandboxPath)
    folder.open('../no.txt', 'w+', err => {
        t.ok(err)
        folder.open(Path.resolve(__dirname, '../no.txt'), 'w+', err => {
            t.ok(err)
            t.end()
        })
    })
})

tape('file api writing operations should work on nonexisting, with w+ flag; also, fd ops should work alongside path-based ops', t => {
    var folder = fss.createFolderSandbox(sandboxPath)
    var file = folder.openSync('created.txt', 'w+')

    // write
    file.writeSync('hello', 0, 'utf-8')
    t.equal(file.readFileSync('utf-8'), 'hello')

    // truncate
    file.truncateSync(4)
    t.equal(file.readFileSync('utf-8'), 'hell')

    // appendFile
    file.appendFileSync('ish', 'utf-8')
    var buf = Buffer.alloc('hellish'.length)
    file.readSync(buf, 0, 'hellish'.length, 0)
    t.equal(buf.toString('utf-8'), 'hellish')

    // cleanup
    file.unlinkSync()
    file.closeSync()

    // should fail
    file.write('closed?', 0, 'utf-8', err => {
        t.ok(err)
        t.end()
    })
})

/*tape('watching inside sandbox', t => {
    t.ok(true);
    var testfile = __dirname + '/fixtures/sandbox/test.txt';

    corefs.writeFileSync(testfile, new Buffer([0xff]));

    var folder = fss.createFolderSandbox([__dirname + '/fixtures']);

    fs.watchFile(testfile, {persistent: false, interval: 10}, function () {
        fs.unwatchFile(testfile);
        t.end()
    });

    corefs.appendFileSync(testfile, new Buffer([0xff]));
})*/

function assertEnoentErr(t, err, expectedPath) {
    t.ok(err);
    t.equal(err.code, 'ENOENT');
    t.equal(err.errno, 34);
    t.equal(err.path, expectedPath);
}
