var tape = require('tape')

var fss = require("../lib/fs-sandbox")
var corefs = require("fs")

const defaultSandboxDir = __dirname + "/fixtures"
const existingInside = __dirname + "/fixtures/a-file.txt"
const existingOutside = __dirname + "/fs-sandbox-test.js"

    /*tearDown: function () {
        var files = corefs.readdirSync(__dirname + "/fixtures/sandbox");
        files.forEach(function (file) {
            corefs.unlinkSync(__dirname + "/fixtures/sandbox/" + file);
        });
    },*/
tape("existingInside actually exists", t => {
    t.ok(corefs.statSync(existingInside))
    t.end()
})

tape("existingOutside actually exists", t => {
    t.ok(corefs.statSync(existingOutside))
    t.end()
})

tape("should call whitelisted async API that takes one argument", t => {
    var fs = fss.createWhitelisted([defaultSandboxDir]);

    fs.stat(existingInside, function (err, stat) {
        t.notOk(err);
        t.equal(stat.size, 16);
        t.end();
    });
})

tape("should fail for whitelisted async API taking one argument", t => {
    var self = this;
    var fs = fss.createWhitelisted([defaultSandboxDir]);

    fs.stat(existingOutside, function (err, stat) {
        t.ok(err);
        t.notOk(stat);
        assertEnoentErr(t, err, existingOutside);
        t.end()
    });
})

tape("should return for whitelisted sync API that takes one argument", t => {
    var fs = fss.createWhitelisted([defaultSandboxDir]);

    var stat = fs.statSync(existingInside);
    t.equal(stat.size, 16);
    t.end()
})

tape("should throw for whitelisted sync API that takes one argument", t => {
    var fs = fss.createWhitelisted([defaultSandboxDir]);

    try {
        fs.statSync(existingOutside);
    } catch(err) {
        assertEnoentErr(t, err, existingOutside);
        t.end()
    }
})

tape("first arg of async multiarg inside whitelisted sandbox", t => {
    var fs = fss.createWhitelisted([defaultSandboxDir]);

    fs.open(existingInside, "r", function (err, fd) {
        t.notOk(err);
        t.ok(fd);
        t.end()
    });
})

tape("second arg of async multiarg inside whitelisted sandbox", t => {
    var fs = fss.createWhitelisted([defaultSandboxDir]);

    fs.open(existingInside, "r", 0666, function (err, fd) {
        t.notOk(err);
        t.ok(fd);
        t.end()
    });
})

tape("first arg of async multiarg outside whitelisted sandbox", t => {
    var self = this;
    var fs = fss.createWhitelisted([defaultSandboxDir]);

    fs.open(existingOutside, "r", function (err, fd) {
        assertEnoentErr(t, err, existingOutside);
        t.notOk(fd);
        t.end()
    });
})

tape("second arg of async multiarg outside whitelisted sandbox", t => {
    var self = this;
    var fs = fss.createWhitelisted([defaultSandboxDir]);

    fs.open(existingOutside, "r", 0666, function (err, fd) {
        assertEnoentErr(t, err, existingOutside);
        t.notOk(fd);
        t.end()
    });
})

tape("accessing relative path outside of sandbox", t => {
    var fs = fss.createWhitelisted([defaultSandboxDir]);

    var relativeOutsidePath = defaultSandboxDir + "/../fs-sandbox-test.js"

    t.ok(corefs.statSync(relativeOutsidePath));

    fs.open(relativeOutsidePath, "r", function (err, fd) {
        assertEnoentErr(t, err, relativeOutsidePath);
        t.notOk(fd);
        t.end()
    });
})

/*tape("watching inside sandbox", t => {
    t.ok(true);
    var testfile = __dirname + "/fixtures/sandbox/test.txt";

    corefs.writeFileSync(testfile, new Buffer([0xff]));

    var fs = fss.createWhitelisted([__dirname + "/fixtures"]);

    fs.watchFile(testfile, {persistent: false, interval: 10}, function () {
        fs.unwatchFile(testfile);
        t.end()
    });

    corefs.appendFileSync(testfile, new Buffer([0xff]));
})*/

function assertEnoentErr(t, err, expectedPath) {
    t.ok(err);
    t.equal(err.code, "ENOENT");
    t.equal(err.errno, 34);
    t.equal(err.path, expectedPath);
}
