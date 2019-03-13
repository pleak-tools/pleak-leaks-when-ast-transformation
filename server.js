var rewriter = require('./src/ast_rewriter');

var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
const uuidv4 = require('uuid/v4');

var fs = require('fs');
var rimraf = require('rimraf');
var path = require('path');
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

  // rimraf.sync(__dirname + `/data/${req.body.diagram_id}`);
  const mode = parseInt('0777', 8) & ~process.umask();

  let dir = __dirname + `/data/${req.body.diagram_id}`;
  if (!fs.existsSync(dir))
    fs.mkdirSync(dir, mode);
  
  dir = __dirname + `/data/${req.body.diagram_id}/run_${req.body.run_number}`;
  if (!fs.existsSync(dir))
    fs.mkdirSync(dir, mode);

  dir = __dirname + `/data/${req.body.diagram_id}/run_${req.body.run_number}/${req.body.selected_dto}`;
  rimraf.sync(dir);
  if (!fs.existsSync(dir))
    fs.mkdirSync(dir, mode);

  

  exec('chmod 777 ' + dir);
  console.log('-----------------------------------');

  // For testing

  // targets = ['test2'];
  // let sql_script = `
  // CREATE TABLE test1 (
  //   product_id bigserial PRIMARY KEY,
  //   name text NOT NULL,
  //   category bigint NOT NULL
  // );
  
  // select count(t1.product_id) as con, avg(t1.category) as pid
  // into test2
  // from test1 as t1
  // where t1.category < 15
  // group by t1.category;
  // `;

  // Works with current given policies for a given role
  let code = rewriter.analyzeLeaksWhen(req.body.sql_script, req.body.policy, targets);
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

app.post('/ga', (req, res) => {
  console.log('-----------------------------------');

  var banachDir = '../pleak-sql-analysis/banach';

  // Policy
  let policyInput = rewriter.analyzeGA(req.body.policy);
  let policyFileId = uuidv4();
  let policyFullPath = `${banachDir}/${policyFileId}.plc`;
  fs.writeFileSync(policyFullPath, policyInput);
  
  // Attacker settings
  let attackerSettingsInput = req.body.attackerSettings[0];
  let attackerSettingsFileId = uuidv4();
  let attackerFullPath = `${banachDir}/${attackerSettingsFileId}.att`;
  fs.writeFileSync(attackerFullPath, attackerSettingsInput);

  // Schemas
  let schemasInput = req.body.schema.join('\n');
  let schemasFileId = uuidv4();
  let schemasFullPath = `${banachDir}/${schemasFileId}.sql`;
  fs.writeFileSync(schemasFullPath, schemasInput);

  // Queries
  let queryInput = req.body.queries.join('\n');
  let queryFileId = uuidv4();
  let queryFullPath = `${banachDir}/${queryFileId}.sql`;
  fs.writeFileSync(queryFullPath, queryInput);
  
  // Tables data
  for(let table in req.body.tableDatas) {
    let tableInput = req.body.tableDatas[table];
    // let tableFileId = uuidv4();
    let tableFullPath = `${banachDir}/${table}.db`;
    fs.writeFileSync(tableFullPath, tableInput);
  }

  // var command = `dist/build/banach/banach -QDpa --db-create-tables demo_schema.sql demo_query.sql demo_attacker.att --policy=demo_policy.plc --epsilon 0.3 --beta 0.0 --numOfQueries 1`;
  var command = `dist/build/banach/banach -QDpa --db-create-tables ${schemasFileId}.sql ${queryFileId}.sql ${attackerSettingsFileId}.att --policy=${policyFileId}.plc --epsilon ${req.body.attackerAdvantage} --numOfQueries 2`;

  exec(command, { cwd: banachDir, maxBuffer: 500 * 1024 }, (err, stdout, stderr) => {
    fs.unlinkSync(policyFullPath);
    fs.unlinkSync(attackerFullPath);
    fs.unlinkSync(schemasFullPath);
    fs.unlinkSync(queryFullPath);

    for(let table in req.body.tableDatas) {
      fs.unlinkSync(`${banachDir}/${table}.db`);
    }

    if (err) {
      console.log(`stderr: ${stderr}`);
      res.send(400, "Oops ... something wrong").end();
      return;
    }
    
    res.send({ result: stdout }).end();
  });
});

app.listen(3000, () => console.log('Listening on port 3000'));