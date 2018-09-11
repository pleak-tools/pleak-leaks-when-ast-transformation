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
app.post('/upload', (req, res) => {
    console.log('-----------------------------------');
    // console.log(req);
    
    var targets = [];
    if (req.body.targets) {
        console.log(req.body.targets);
        targets = req.body.targets.split(',');
    }
    var model_name = !req.body.model ? "tmp" : req.body.model;
    console.log(model_name);

    rimraf.sync("/tmp/" + model_name);
    fs.mkdirSync("/tmp/" + model_name);
    console.log('-----------------------------------');
    console.log(__dirname);

    // Writing petri net from front-end to file, this is input for unfolder
    fs.writeFileSync(req.body.digram_id + '.json', req.body.petri);

    exec(`java -cp ".:../lib/*" ee.ut.eventstr.confcheck.test.Unfolder ` + req.body.digram_id, {cwd: __dirname + '/eventstr-confchecking/bin'}, (err, stdout, stderr) => {
      if (err) {
          console.log(`stderr: ${stderr}`);
          res.send(400, "Oops ... something wrong").end();
          return;
      }

      // Parsing unfolder response
      let runs = JSON.parse(fs.readFileSync(__dirname + '/eventstr-confchecking/bin/target/' + req.body.digram_id + '_result.json', 'utf8'));
      console.log(runs);

      // Matching ids from result and sql scripts
      let matcher = req.body.matcher;
      let sql_script = "";

      for(let i = 0; i < runs[0].length; i++) {
        sql_script += matcher[runs[0][i]] ? matcher[runs[0][i]] : "";
      }

      let code = rewriter.analyze(sql_script, targets);
      fs.writeFileSync('./pleak-leaks-when-analysis/src/RAInput.ml', code);
      exec(`/usr/pleak/scripts/script.sh /data/${model_name}`, (err, stdout, stderr) => {
          if (err) {
              console.log(`stderr: ${stderr}`);
              res.send(400, "Oops ... something wrong").end();
              return;
          }
          let files = fs.readdirSync(`/data/${model_name}`).map(elem => `/leaks-when/data/${model_name}/${elem}`);
          res.send({files: files}).end();
      });
    });
});
app.listen(3000, () => console.log('Listening on port 3000'));