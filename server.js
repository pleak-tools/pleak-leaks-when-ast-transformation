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

  // For testing

  // targets = ['sird_counts'];
  // let sql_script = `
  // CREATE TABLE test1 (
  //   product_id bigserial PRIMARY KEY,
  //   name text NOT NULL,
  //   category bigint NOT NULL
  // );
  
  // select count(t1.product_id) as con, avg(t1.product_id) as pid
  // into test2
  // from test1 as t1
  // where t1.product_id < 5
  // group by t1.category;
  // `;

  // let sql_script = `
  // create table Person (
  //   ID INT8 primary key,
  //   First_Name TEXT,
  //   Last_Name TEXT,
  //   Birthdate DATE,
  //   Date_Of_Death DATE,
  //   Residence TEXT references Community(name),
  //   Gender INT8
  // );

  // create table Params (
  //   ID INT8 primary key,
  //   Max_Queries INT8,
  //   Accuracy INT8,
  //   Confidence INT8,
  //   Ref_Day INT8
  // );

  // create table Disease_Status (
  //   Person_ID INT8,
  //   Date_Of_Control INT8,
  //   Disease_State INT8,
  //   PRIMARY KEY (Person_ID, Date_Of_Control)
  // );

  // create table Communities_of_interest (
  //   Name TEXT primary key
  // );

  // create table Community (
  //   Name TEXT primary key,
  //   Latitude INT8,
  //   Longitude INT8
  // );

  // create or replace function Compute_Total_Population()
  // returns TABLE (Total_Population INT8) as 
  // $$
  //   select count(Person.ID) as con
  //   from Person, Communities_Of_Interest
  //   where Communities_Of_Interest.Name = Person.Residence
  // $$
  // language SQL;

  // select totals.con as res
  // into total_people
  // from Compute_Total_Population() as totals;

  // create or replace function Collect_SIRD_Counts()
  // returns TABLE (The_Date INT8, Community_Name TEXT, Disease_State INT8, Corresponding_Count INT8) as 
  // $$
  //   select Disease_Status.Date_Of_Control as date2,
  //         Communities_Of_Interest.Name as name2, 
  //         Disease_Status.Disease_State as ds, count(Person.ID) as con2
  //   from Disease_Status, Communities_Of_Interest, Person, Params
  //   where Communities_Of_Interest.Name = Person.Residence
  //     and Person.ID = Disease_Status.Person_ID
  //     and Disease_Status.Date_Of_Control > (Params.Ref_Day - Params.Max_Queries + 1)
  //     and Disease_Status.Date_Of_Control < Params.Ref_Day
  //   group by Disease_Status.Date_Of_Control,
  //         Communities_Of_Interest.Name, 
  //         Disease_Status.Disease_State
  // $$
  // language SQL;

  // select sird.date2 as date, sird.con2 as quant
  // into sird_counts
  // from Collect_SIRD_Counts() as sird;
  // `;

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