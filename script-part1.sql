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
