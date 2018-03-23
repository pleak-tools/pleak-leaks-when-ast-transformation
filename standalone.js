var rewriter = require('./src/ast_rewriter');

let query = `
    SELECT s.port_id as port_id, s.berth_id as berth_id, row_number() OVER (PARTITION BY port_id, berth_id) AS row_id, s.slotstart as slotstart, s.slotend as slotend
  into slot1
  FROM slot as s
  ORDER BY port_id, berth_id, slotstart;
`;

// COALESCE(slot1.port_id, slot2.port_id) AS port_id,
//   COALESCE(slot1.berth_id, slot2.berth_id) AS berth_id, 
//   row_number() OVER (PARTITION BY port_id, berth_id) AS gap_id,
//     COALESCE(slot1.slotend, slot2.slotstart) AS slot_gap,
//     COALESCE(slot1.slotend, 0) AS gapstart, 
//   COALESCE(slot2.slotstart, 30) AS gapend
//   FROM slot1
//   FULL JOIN slot1 AS slot2 ON
//   slot1.port_id = slot2.port_id AND
//   slot1.berth_id = slot2.berth_id AND
//   slot1.row_id + 1 = slot2.row_id 
//   WHERE COALESCE(slot1.slotend, 0) < COALESCE(slot2.slotstart, 30)
//   ORDER BY port_id, berth_id, slot_gap;


// let query = `
// SELECT COALESCE(slot1.port_id, slot2.port_id) AS port_id,
//   COALESCE(slot1.berth_id, slot2.berth_id) AS berth_id, 
//   row_number() OVER (PARTITION BY port_id, berth_id) AS gap_id,
//   COALESCE(slot1.slotend, slot2.slotstart) AS slot_gap,
//   COALESCE(slot1.slotend, 0) AS gapstart, 
//   COALESCE(slot2.slotstart, 30) AS gapend
//   FROM slot1
//   FULL JOIN slot1 AS slot2 ON
//   slot1.port_id = slot2.port_id AND
//   slot1.berth_id = slot2.berth_id AND
//   slot1.row_id + 1 = slot2.row_id 
//   WHERE COALESCE(slot1.slotend, 0) < COALESCE(slot2.slotstart, 30)
//   ORDER BY port_id, berth_id, slot_gap;
// `;

// let query = `
//   SELECT slot.port_id as port_id, slot.berth_id as berth_id, row_number() OVER (PARTITION BY slot.port_id, slot.berth_id) AS row_id, slot.slotstart as slotstart, slot.slotend as slotend
//   into slot1
//   FROM slot
//   ORDER BY slot.port_id, slot.berth_id, slot.slotstart
// `;

// let query =`
// create or replace function earliest_arrival(
//   ship_lat INT,
//   ship_long INT,
//   port_lat INT,
//   port_long INT,
//   max_speed BIGINT)
//   returns BIGINT as
// $$
//   select ((POINT(ship_lat, ship_long) <@> POINT(port_lat, port_long)) / max_speed)
// $$
// language SQL IMMUTABLE returns NULL on NULL INPUT;

// create or replace function compute_reachable_ports(deadline BIGINT, shipname TEXT)
// returns TABLE (port_id BIGINT, arrival BIGINT) as 
// $$
// select port.port_id as port_id, earliest_arrival(ship.longitude, ship.latitude,
//     port.longitude, port.latitude, ship.maxspeed) as arrival
// from port, ship
// where earliest_arrival(ship.longitude, ship.latitude,
//     port.longitude, port.latitude, ship.maxspeed) <= deadline
//     and ship.name = shipname
//     and port.port_id = port.port_id;
// $$
// language SQL;

// SELECT rports.port_id as port_id, rports.arrival as arrival INTO reachable_ports
// FROM compute_reachable_ports(:deadline, :shipname) as rports;

// SELECT rport.port_id as port_id, port.name as port_name, earliest_arrival(POINT(ship.longitude, ship.latitude),
//        POINT(port.longitude, port.latitude), ship.maxspeed) AS arrival
// INTO step_a
// FROM reachable_ports AS rport, port, ship
// WHERE port.port_id = rport.port_id
//   AND ship.name = :shipname
// ORDER BY rport.arrival;

// create or replace function compute_feasible_ports(shipname TEXT)
//   returns TABLE (port_id BIGINT) as
// $$
//   select port.port_id
//   from reachable_ports, port, ship
//   where reachable_ports.port_id = port.port_id
//     and port.available = true
//     and port.harbordepth >= ship.draft 
//     and port.offloadcapacity >= ship.cargo
//     and ship.name = shipname;
// $$
// language SQL;
// `;

let code = rewriter.analyze(query, []);
