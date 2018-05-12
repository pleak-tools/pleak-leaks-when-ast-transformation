CREATE TABLE parameters (
  param_id UNIT PRIMARY KEY,
  deadline INT,
  shipname TEXT
);

CREATE TABLE ship (
  ship_id bigserial PRIMARY KEY,
  name text NOT NULL,
  cargo bigint,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  length bigint,
  draft bigint,
  maxspeed bigint
);

CREATE TABLE port (
  port_id bigserial PRIMARY KEY,
  name text NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  offloadcapacity bigint,
  offloadtime bigint,
  harbordepth bigint,
  available boolean
);

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

-- =============================================================================
-- DML STATEMENTS
-- =============================================================================

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
select port.port_id as port_id, 
    earliest_arrival(ship.longitude, ship.latitude,
                     port.longitude, port.latitude, ship.maxspeed) as arrival
from port, ship
where earliest_arrival(ship.longitude, ship.latitude,
    port.longitude, port.latitude, ship.maxspeed) <= deadline
  and ship.name = shipname
  and port.port_id = port.port_id;
$$
language SQL;

SELECT rports.port_id as port_id, rports.arrival as arrival INTO reachable_ports
FROM parameters as p cross join lateral compute_reachable_ports(p.deadline, p.shipname) as rports;

create or replace function compute_feasible_ports(shipname TEXT)
  returns TABLE (port_id BIGINT) as
$$
  select port.port_id as port_id
  from reachable_ports, port, ship
  where reachable_ports.port_id = port.port_id
    and port.available
    and port.harbordepth >= ship.draft 
    and port.offloadcapacity >= ship.cargo
    and ship.name = shipname;
$$
language SQL;

select fports.port_id as port_id into feasible_ports
from parameters as p cross join lateral compute_feasible_ports(p.shipname) as fports;

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
  row_number() OVER (PARTITION BY port_id, berth_id) AS gap_id,
  COALESCE(slot1.slotend, slot2.slotstart) AS gap,
  COALESCE(slot1.slotend, 0) AS gapstart,
  COALESCE(slot2.slotstart, 30) AS gapend
into available_slots
FROM slot1
FULL JOIN slot1 AS slot2 ON
  slot1.port_id = slot2.port_id AND
  slot1.berth_id = slot2.berth_id AND
  slot1.row_id + 1 = slot2.row_id
WHERE COALESCE(slot1.slotend, 0) < COALESCE(slot2.slotstart, 30)
ORDER BY port_id, berth_id, gap;