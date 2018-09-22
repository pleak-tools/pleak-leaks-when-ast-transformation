CREATE TABLE parameters (
  param_id UNIT PRIMARY KEY,
  deadline INT,
  shipname TEXT
);

CREATE TABLE port_1 (
  port_id bigserial PRIMARY KEY,
  name text NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  offloadcapacity bigint,
  offloadtime bigint,
  harbordepth bigint,
  available boolean
);

CREATE TABLE ship_2 (
  ship_id bigserial PRIMARY KEY,
  name text NOT NULL,
  cargo bigint,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  length bigint,
  draft bigint,
  maxspeed bigint
);

SELECT p1.port_id as port_id, 
  p1.name as name, 
  p1.latitude as latitude, 
  p1.longitude as longitude, 
  p1.offloadcapacity as offloadcapacity, 
  p1.offloadtime as offloadtime, 
  p1.harbordepth as harbordepth, 
  p1.available as available
INTO port_2 
FROM port_1 as p1;

create or replace function earliest_arrival(
  ship_lat DOUBLE PRECISION,
  ship_long DOUBLE PRECISION,
  port_lat DOUBLE PRECISION,
  port_long DOUBLE PRECISION,
  max_speed BIGINT)
  returns BIGINT as
$$
  select ceil((POINT(ship_lat, ship_long) <@> POINT(port_lat, port_long)) / max_speed)::BIGINT
$$
language SQL IMMUTABLE returns NULL on NULL INPUT;

create or replace function compute_reachable_ports(deadline BIGINT, shipname TEXT)
returns TABLE (port_id BIGINT, arrival BIGINT) as 
$$
select port_2.port_id as port_id, ship_2.ship_id as ship_id, ship_2.name as name, ship_2.cargo as cargo, ship_2.draft as draft, 
    earliest_arrival(ship_2.longitude, ship_2.latitude,
                     port_2.longitude, port_2.latitude, ship_2.maxspeed) as arrival
from port_2, ship_2
where earliest_arrival(ship_2.longitude, ship_2.latitude,
    port_2.longitude, port_2.latitude, ship_2.maxspeed) <= deadline
  and ship_2.name = shipname
  and port_2.port_id = port_2.port_id;
$$
language SQL;


SELECT rports.port_id as port_id, rports.arrival as arrival 
INTO reachable_ports_2 
FROM parameters as p cross join lateral compute_reachable_ports(p.deadline, p.shipname) as rports;
SELECT rports.ship_id as ship_id, rports.name as name, rports.cargo as cargo, rports.draft as draft 
INTO ship_requirements_2 
FROM parameters as p cross join lateral compute_reachable_ports(p.deadline, p.shipname) as rports;
SELECT ns2.ship_id as ship_id, 
ns2.name as name, 
ns2.cargo as cargo, 
ns2.draft as draft 
INTO ship_requirements_1 
FROM ship_requirements_2 as ns2;
SELECT rp2.port_id as port_id, 
rp2.arrival as arrival 
INTO reachable_ports_1 
FROM reachable_ports_2 as rp2;
create or replace function compute_feasible_ports(shipname TEXT)
  returns TABLE (port_id BIGINT) as
$$
  select port_2.port_id as port_id
  from reachable_ports_2, port_2, ship_2
  where reachable_ports_2.port_id = port_2.port_id
    and port_2.available
    and port_2.harbordepth >= ship_2.draft 
    and port_2.offloadcapacity >= ship_2.cargo
    and ship_2.name = shipname;
$$
language SQL;


select fports.port_id as port_id 
into feasible_ports_1 
from parameters as p cross join lateral compute_feasible_ports(p.shipname) as fports;
SELECT fp1.port_id as port_id 
INTO feasible_ports_2 
FROM feasible_ports_1 as fp1;
CREATE TABLE berth (
  port_id bigint,
  berth_id bigint,
  berthlength bigint,
  PRIMARY KEY (port_id, berth_id)
);


CREATE TABLE slot (
  port_id bigint,
  berth_id bigint,
  slot_id bigint,
  ship_id bigint REFERENCES ship NOT NULL,
  slotstart bigint,
  slotend bigint,
  PRIMARY KEY (port_id, berth_id, slot_id),
  FOREIGN KEY (port_id, berth_id) REFERENCES berth (port_id, berth_id)
);

SELECT slot.port_id as port_id, 
       slot.berth_id as berth_id, 
       row_number() OVER (PARTITION BY port_id, berth_id) AS row_id, 
       slot.slotstart as slotstart, 
       slot.slotend as slotend
INTO slot1
FROM slot
ORDER BY port_id, berth_id, slotstart;


SELECT COALESCE(slot1.port_id, slot2.port_id) AS port_id,
  COALESCE(slot1.berth_id, slot2.berth_id) AS berth_id,
  row_number() OVER (PARTITION BY port_id, berth_id) AS slot_id,
  COALESCE(slot1.slotend, slot2.slotstart) AS gap,
  COALESCE(slot1.slotend, 0) AS slotstart,
  COALESCE(slot2.slotstart, 30) AS slotend
into available_slots
FROM slot1
FULL JOIN slot1 AS slot2 ON
  slot1.port_id = slot2.port_id AND
  slot1.berth_id = slot2.berth_id AND
  slot1.row_id + 1 = slot2.row_id
WHERE COALESCE(slot1.slotend, 0) < COALESCE(slot2.slotstart, 30)
ORDER BY port_id, berth_id, gap;


SELECT port_2.port_id as port_id, 
  availslot.berth_id as berth_id, 
  availslot.slot_id as slot_id,
  GREATEST(rport.arrival, availslot.slotstart) AS offloadstart
INTO slot_assignment_2
FROM reachable_ports_2 AS rport, feasible_ports_2 AS fport, port_2, 
available_slots AS availslot, berth, ship_2
WHERE port_2.port_id = fport.port_id
AND port_2.port_id = rport.port_id
AND port_2.port_Id = berth.port_id 
AND availslot.port_id = berth.port_id
AND availslot.berth_id = berth.berth_id
AND ship_2.name = shipname 
AND berth.berthlength >= ship_2.length
AND rport.arrival <= deadline AND availslot.slotstart <= deadline
AND rport.arrival + port_2.offloadtime <= availslot.slotend
AND availslot.slotstart + port_2.offloadtime <= availslot.slotend
ORDER BY offloadstart, port_id, berth_id;
SELECT sa2.port_id as port_id, 
  sa2.berth_id as berth_id, 
  sa2.slot_id as slot_id, 
  sa2.offloadstart as offloadstart 
INTO slot_assignment_1
FROM slot_assignment_2 as sa2;