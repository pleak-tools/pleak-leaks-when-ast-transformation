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

app.use('/leaks-when/data', express.static('/data'));

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

  rimraf.sync("/data/" + model_name);
  fs.mkdirSync("/data/" + model_name);
  console.log('-----------------------------------');

  let code = rewriter.analyze(req.body.sql_script, targets);
  fs.writeFileSync('./pleak-leaks-when-analysis/src/RAInput.ml', code);
  exec(`/usr/pleak/scripts/script.sh /data/${model_name}`, (err, stdout, stderr) => {
    if (err) {
      console.log(`stderr: ${stderr}`);
      res.send(400, "Oops ... something wrong").end();
      return;
    }
    let files = fs.readdirSync(`/data/${model_name}`).map(elem => `/leaks-when/data/${model_name}/${elem}`);
    res.send({ files: files }).end();
  });
});
app.listen(3000, () => console.log('Listening on port 3000'));