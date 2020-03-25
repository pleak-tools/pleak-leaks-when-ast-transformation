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
/*
let sql_script = `
CREATE TABLE port ( port_id INT8 PRIMARY KEY, name TEXT, latitude INT8, longitude INT8, offloadcapacity INT8, offloadtime INT8, harbordepth INT8, available BOOL);
CREATE TABLE parameters ( param_id INT8 PRIMARY KEY, deadline INT8, portname TEXT);
CREATE TABLE ship ( ship_id INT8 PRIMARY KEY, name TEXT, cargo INT8, latitude INT8, longitude INT8, length INT8, draft INT8, max_speed INT8);
CREATE TABLE berth (
  berth_id INT8 primary key,
  port_id INT8);
CREATE TABLE slot (
  slot_id INT8 primary key,
  port_id INT8,
  berth_id INT8,
  slotstart INT8,
  slotend INT8);
*/
/*
 intermediate tables
 ast-transformer does not like tables without primary keys

CREATE TABLE port_enc (
 port_id INT8 primary key, 
 name TEXT, 
 latitude INT8, 
 longitude INT8, 
 offloadcapacity INT8, 
 offloadtime INT8, 
 harbordepth INT8, 
 available Bool);
CREATE TABLE aggr_count_enc (
 name TEXT, cnt INT8);
CREATE TABLE aggr_count (
 name TEXT, cnt INT8);
CREATE TABLE capacities (
 portname TEXT,
 slots_number INT8);
CREATE TABLE ship_count (
num_of_ships INT8);
*/
/*
select 
 port.port_id as port_id, 
  port.name as name, 
  port.latitude as latitude, 
  port.longitude as longitude, 
  port.offloadcapacity as offloadcapacity, 
  port.offloadtime as offloadtime, 
  port.harbordepth as harbordepth, 
  port.available as available
into port_enc
from port;

create or replace function aggr_count(portname TEXT)
 returns TABLE(cnt INT8) as
$$
select port.name AS name, count(*) as cnt
from ship, port_enc, port, parameters
where port_enc.name = parameters.portname
 	AND ((ship.latitude - port_enc.latitude) ^ 2 + (ship.longitude - port_enc.longitude) ^ 2) ^ 0.5 / ship.max_speed <= parameters.deadline
    AND port.name = port_enc.name
group by port.name
$$
language SQL IMMUTABLE returns NULL on NULL INPUT;

select p.name as name, 
  res.cnt as cnt 
  into aggr_count_enc 
  from port_enc as p cross join aggr_count(p.name) as res;

select ac2.name as name,
       ac2.cnt as cnt
into aggr_count
from aggr_count_enc as ac2;

create or replace function slots_count(portname TEXT)
 returns TABLE(slots_number INT8) as
$$
select port.name AS portname, count(slot.slot_id) as slots_number
 from port, slot, berth, parameters
 where port.name = parameters.portname
 AND port.port_id = berth.port_id
 AND slot.port_id = berth.port_id
 AND slot.berth_id = berth.berth_id 
 AND slot.slotstart <= parameters.deadline
 AND slot.slotstart + port.offloadtime <= slot.slotend
group by port.name
$$
language SQL IMMUTABLE returns NULL on NULL INPUT;

select p.name as portname, arr.slots_number as slots_number
into capacities
from port as p cross join slots_count(p.name) as arr;

SELECT
   ac.name as name,
   greatest(ac.cnt, cp.slots_number) as num_of_ships
into ship_count_temp
from aggr_count AS ac, capacities AS cp, parameters
 where ac.name = cp.portname
 and ac.name = parameters.portname
;

SELECT
   sct.name as name,
   MAX(sct.num_of_ships) as num_of_ships
into ship_count
from ship_count_temp as sct, port
 where sct.name = port.name
 group by port.name
;
`;

targets = ['ship_count'];
*/

let sql_script = `
create table ship ( 
  ship_id INT8 primary key, 
  name TEXT, 
  cargo INT8, 
  latitude INT8, 
  longitude INT8, 
  length INT8, 
  draft INT8, 
  max_speed INT8 
); 
create table port 
(  
  port_id INT8 primary key,  
  name TEXT,  
  latitude INT8,  
  longitude INT8,  
  offloadcapacity INT8,  
  offloadtime INT8,  
  harbordepth INT8,  
  available Bool); 
CREATE TABLE parameters ( param_id INT8 PRIMARY KEY, deadline INT8, portname TEXT); 
CREATE OR REPLACE FUNCTION aggr_count(portname TEXT) RETURNS TABLE(cnt INT8) AS  
$$  
    SELECT COUNT(ship.ship_id) AS cnt  
    FROM ship, port, parameters 
    WHERE port.name = parameters.portname AND (POINT(ship.latitude,ship.longitude) <@> POINT(port.latitude,port.longitude)) / ship.max_speed <= parameters.deadline  
$$  
language SQL IMMUTABLE returns NULL on NULL INPUT;  
 
SELECT port.port_id AS name, MAX(res.cnt) AS cnt 
INTO result 
FROM port CROSS JOIN aggr_count(port.name) AS res 
GROUP BY port.port_id;

`;
targets = ['result'];

/*
let sql_script = `
CREATE TABLE port ( port_id INT8 PRIMARY KEY, name TEXT, latitude INT8, longitude INT8, offloadcapacity INT8, offloadtime INT8, harbordepth INT8, available BOOL);
CREATE TABLE parameters ( param_id INT8 PRIMARY KEY, deadline INT8, portname TEXT);
CREATE TABLE ship ( ship_id INT8 PRIMARY KEY, name TEXT, cargo INT8, latitude INT8, longitude INT8, length INT8, draft INT8, max_speed INT8);
CREATE TABLE result (name TEXT PRIMARY KEY, cnt INT8);

CREATE OR REPLACE FUNCTION aggr_count(portname TEXT) RETURNS TABLE(cnt INT8) AS 
$$ 
    SELECT COUNT(ship.ship_id) AS cnt 
    FROM ship, port, parameters
    WHERE port.name = parameters.portname AND (POINT(ship.latitude,ship.longitude) <@> POINT(port.latitude,port.longitude)) / ship.max_speed <= parameters.deadline 
$$ 
language SQL IMMUTABLE returns NULL on NULL INPUT; 

SELECT port.port_id AS name, MAX(res.cnt) AS cnt
INTO result
FROM port CROSS JOIN aggr_count(port.name) AS res
GROUP BY port.port_id;
`;
targets = ['result'];
*/

/*
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
*/

/*
let sql_script = `
create table ship (
  ship_id INT8 primary key,
  name TEXT,
  latitude INT8,
  longitude INT8,
  cargo INT8,
  max_speed INT8
);


SELECT
    SUM (ship.latitude) AS tmp
INTO capacities_1
FROM
    ship AS ship
;
`;

targets = ['result'];
*/

let policy = []

let code = rewriter.analyzeLeaksWhen(sql_script, policy, targets);
fs.writeFileSync(__dirname + '/pleak-leaks-when-analysis/src/RAInput.ml', code);
var command = __dirname + `/scripts/scriptGA.sh ` + __dirname + ` /../pleak-sql-analysis/banach/lightweight-examples/ships/clean.sql `;
var commandBuild = __dirname + `/scripts/buildGA.sh ` + __dirname;

  exec(commandBuild, (err, stdout, stderr) => {
    if (err) {
      console.log(`stderr: ${stderr}`);
      return;
    } else {
      console.log(`stdout: ${stdout}`);
    }
   exec(command, { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) {
      console.log(`stderr: ${stderr}`);
      return;
    } else {
      console.log(`stdout: ${stdout}`);
    }

    console.log(`good!`);
  });
});

