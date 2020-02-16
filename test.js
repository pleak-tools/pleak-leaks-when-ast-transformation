var rewriter = require('./src/ast_rewriter');

var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
const uuidv4 = require('uuid/v4');

var fs = require('fs');
var rimraf = require('rimraf');
var path = require('path');
const exec = require('child_process').exec;

  // For testing
let sql_script = `
CREATE TABLE port_1 ( port_id INT8 PRIMARY KEY, name TEXT, latitude INT8, longitude INT8, offloadcapacity INT8, offloadtime INT8, harbordepth INT8, available BOOL);
CREATE TABLE port_2 ( port_id INT8 PRIMARY KEY, name TEXT, latitude INT8, longitude INT8, offloadcapacity INT8, offloadtime INT8, harbordepth INT8, available BOOL);
CREATE TABLE parameters ( param_id INT8 PRIMARY KEY, deadline INT8, portname TEXT);
CREATE TABLE berth ( berth_id INT8 PRIMARY KEY, port_id INT8, berthlength INT8);
CREATE TABLE slot ( slot_id INT8 PRIMARY KEY, port_id INT8, berth_id INT8, slotstart INT8, slotend INT8);
CREATE TABLE ship_2 ( ship_id INT8 PRIMARY KEY, name TEXT, cargo INT8, latitude INT8, longitude INT8, length INT8, draft INT8, max_speed INT8);

CREATE OR REPLACE FUNCTION aggr_count(portname TEXT) RETURNS TABLE(cnt INT8) AS 
$$ 
    SELECT COUNT(ship_2.ship_id) AS cnt 
    FROM ship_2, port_2, parameters 
    WHERE port_2.name = parameters.portname AND ((ship_2.latitude - port_2.latitude)^2 + (ship_2.longitude - port_2.longitude)^2) ^ 0.5 / ship_2.max_speed <= parameters.deadline 
$$ 
language SQL IMMUTABLE returns NULL on NULL INPUT; 


SELECT p.name AS name, res.cnt AS cnt INTO aggr_count_2 FROM port_2 AS p CROSS JOIN aggr_count(p.name) AS res;

SELECT ac2.name AS name, ac2.cnt AS cnt INTO aggr_count_1 FROM aggr_count_2 AS ac2;

CREATE OR REPLACE FUNCTION slots_count(portname TEXT) RETURNS TABLE(slots_number INT8) AS $$ SELECT COUNT(slot.slot_id) AS slots_number FROM port_1, aggr_count_1, slot, berth, parameters WHERE aggr_count_1.name = port_1.name AND port_1.name = parameters.portname AND port_1.port_id = berth.port_id AND slot.port_id = berth.port_id AND slot.berth_id = berth.berth_id AND slot.slotstart <= parameters.deadline AND slot.slotstart + port_1.offloadtime <= slot.slotend $$ language SQL IMMUTABLE returns NULL on NULL INPUT; 

SELECT p.name AS portname, res.slots_number AS slots_number INTO capacities_1 FROM port_1 AS p CROSS JOIN slots_count(p.name) AS res;
`;

targets = ['capacities_1'];
let policy = []

let code = rewriter.analyzeLeaksWhen(sql_script, policy, targets);
fs.writeFileSync(__dirname + '/../pleak-leaks-when-analysis/src/RAInput.ml', code);
