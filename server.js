var rewriter = require('./src/ast_rewriter');

var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');

var fs = require('fs');
var rimraf = require('rimraf');
const exec = require('child_process').exec;

console.log(rewriter);

var app = express();
app.use(bodyParser.json());
app.use(cors());

// Serving dot files as output from data directory
app.use('/leaks-when/data', express.static(__dirname + '/data'));

app.post('/compute', (req, res) => {
  let petriPath = __dirname + '/eventstr-confchecking/bin/target/';

  // Writing petri net from front-end to file, this is input for unfolder
  fs.writeFileSync(petriPath + req.body.diagram_id + '.json', req.body.petri);

  exec(`java -cp ".:../lib/*" ee.ut.eventstr.confcheck.test.Unfolder ` + req.body.diagram_id, { cwd: __dirname + '/eventstr-confchecking/bin' }, (err, stdout, stderr) => {
    if (err) {
      console.log(`stderr: ${stderr}`);
      res.send(400, "Oops ... something wrong").end();
      return;
    }

    // Parsing unfolder response
    let runs = JSON.parse(fs.readFileSync(petriPath + req.body.diagram_id + '_result.json', 'utf8'));
    console.log(runs);

    res.send({ runs: runs }).end();
  });
});

app.post('/upload', (req, res) => {
  console.log('-----------------------------------');
  // console.log(req);

  let targets = [];
  if (req.body.targets) {
    console.log(req.body.targets);
    targets = req.body.targets.split(',');
  }
  var model_name = !req.body.model ? "tmp" : req.body.model;
  console.log(model_name);

  rimraf.sync(__dirname + "/data/" + model_name);
  const mode = parseInt('0777', 8) & ~process.umask();
  fs.mkdirSync(__dirname + "/data/" + model_name, mode);
  exec('chmod 777 ' + __dirname + "/data/" + model_name);
  console.log('-----------------------------------');

  let code = rewriter.analyze(req.body.sql_script, targets);
  fs.writeFileSync(__dirname + '/pleak-leaks-when-analysis/src/RAInput.ml', code);
  var command = __dirname + `/scripts/script.sh ` + __dirname + ` /data/${model_name}`;
  exec(command, {
    maxBuffer: 500 * 1024 // otherwise analyzer will suddenly stop after 200 kb of console output
  }, (err, stdout, stderr) => {
    if (err) {
      console.log(`stderr: ${stderr}`);
      res.send(400, "Oops ... something wrong").end();
      return;
    }
    let files = fs.readdirSync(__dirname + `/data/${model_name}`).map(elem => `/leaks-when/data/${model_name}/${elem}`);
    res.send({ files: files }).end();
  });
});
app.listen(3000, () => console.log('Listening on port 3000'));