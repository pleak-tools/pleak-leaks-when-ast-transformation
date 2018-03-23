var rewriter = require('./src/ast_rewriter');

var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');

var fs = require('fs');
var rimraf = require('rimraf');
const exec = require('child_process').exec;

console.log(rewriter);

var app = express();
app.use(bodyParser.text());
app.use(cors());

app.get('/', (req, res) => res.send('hello world'));
app.post('/upload', (req, res) => {
    console.log('-----------------------------------');
    console.log(req.body);
    var targets = [];
    if (req.query.targets) {
        console.log(req.query.targets);
        targets = req.query.targets.split(',');
    }
    var model_name = !req.query.model ? "tmp" : req.query.model;

    rimraf.sync("/data/" + model_name);
    fs.mkdirSync("/data/" + model_name);
    let code = rewriter.analyze(req.body, targets);
    console.log('-----------------------------------');
    
    fs.writeFileSync('./pleak-leaks-when-analysis/src/RAInput.ml', code);
    exec(`/usr/pleak/scripts/script.sh /data/${model_name}`, (err, stdout, stderr) => {
        if (err) {
            console.log(`stderr: ${stderr}`);

            res.send("Oops ... something wrong").end();
            return;
        }
        res.send(code).end();
    });
});
app.listen(3000, () => console.log('Listening on port 3000'));