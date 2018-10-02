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

CREATE TABLE parameters (
  param_id UNIT PRIMARY KEY,
  deadline INT,
  shipname TEXT
);

SELECT p1.port_id as port_id,   
  p1.latitude as latitude, 
  p1.longitude as longitude
INTO port_2 
FROM port_1 as p1;

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
  select port_2.port_id as port_id, ship_2.cargo as cargo, ship_2.draft as draft, 
      earliest_arrival(ship_2.longitude, ship_2.latitude,
                       port_2.longitude, port_2.latitude, ship_2.maxspeed) as arrival
  from port_2, ship_2
  where earliest_arrival(ship_2.longitude, ship_2.latitude,
      port_2.longitude, port_2.latitude, ship_2.maxspeed) <= deadline; 
  $$
  language SQL;

SELECT rports.port_id as port_id, 
  rports.cargo as cargo, 
  rports.draft as draft 
  INTO ship_requirements_2 
  FROM parameters as p cross join lateral compute_reachable_ports(p.deadline, p.shipname) as rports;
  
SELECT rports.port_id as port_id, 
  rports.arrival as arrival 
  INTO reachable_ports_2 
  FROM parameters as p cross join lateral compute_reachable_ports(p.deadline, p.shipname) as rports;

SELECT sr1.port_id as port_id, 
  sr1.cargo as cargo, 
  sr1.draft as draft 
  INTO ship_requirements_1 
  FROM ship_requirements_2 as sr1;
  
SELECT rports.port_id as port_id, 
  rports.arrival as arrival 
  INTO reachable_ports_1 
  FROM reachable_ports_2 as rports;

create or replace function compute_feasible_ports()
    returns TABLE (port_id BIGINT) as
  $$
    select rp1.port_id as port_id,
      p1.harbordepth as harbordepth,
      p1.offloadcapacity as offloadcapacity
    from reachable_ports_1 as rp1, ship_requirements_1 as sr1, port_1 as p1
    where p1.port_id = sr1.port_id 
      and p1.port_id = rp1.port_id
      and rp1.port_id = sr1.port_id
      and p1.available 
      and p1.harbordepth >= sr1.draft 
      and p1.offloadcapacity >= sr1.cargo;
  $$
  language SQL;

  select fports.port_id as port_id, 
    fports.harbordepth as harbordepth, 
    fports.offloadcapacity as offloadcapacity 
  into feasible_ports_1 
  from compute_feasible_ports() as fports;

SELECT fp1.port_id as port_id,
fp1.harbordepth as harbordepth, 
fp1.offloadcapacity as offloadcapacity 
INTO feasible_ports_2 
FROM feasible_ports_1 as fp1;

create or replace function select_ships()
  returns TABLE (port_id BIGINT, ship_id bigserial, length BIGINT) as 
  $$
  select port_2.port_id as port_id, ship_2.length as length, ship_2.ship_id as ship_id, 
      earliest_arrival(ship_2.longitude, ship_2.latitude,
                       port_2.longitude, port_2.latitude, ship_2.maxspeed) as arrival
  from port_2, ship_2, feasible_ports_2 as fp2
  where port_2.port_id = fp2.port_id
  $$
  language SQL;


  SELECT ships.port_id as port_id, 
  ships.ship_id as ship_id, 
  ships.length as length 
  INTO ship_information_2 
  FROM parameters as p cross join lateral select_ships(p.deadline) as ships;

SELECT si2.ship_id as ship_id,
si2.length as length
INTO ship_information_1 
FROM ship_information_2 as si2;

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


SELECT port_1.port_id as port_id, 
  availslot.berth_id as berth_id, 
  availslot.slot_id as slot_id,
  GREATEST(rport.arrival, availslot.slotstart) AS offloadstart
INTO slot_assignment_1
FROM reachable_ports_1 AS rport, feasible_ports_1 AS fport, port_1, 
available_slots AS availslot, berth, ship_information_1
WHERE port_1.port_id = fport.port_id
AND port_1.port_id = rport.port_id
AND port_1.port_Id = berth.port_id 
AND availslot.port_id = berth.port_id
AND availslot.berth_id = berth.berth_id
AND berth.berthlength >= ship_information_1.length
AND rport.arrival <= deadline AND availslot.slotstart <= deadline
AND rport.arrival + port_1.offloadtime <= availslot.slotend
AND availslot.slotstart + port_1.offloadtime <= availslot.slotend
ORDER BY offloadstart, port_id, berth_id;