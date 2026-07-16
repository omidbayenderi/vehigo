-- Adds "tractor_unit" (Çekici / Sattelzugmaschine) as its own vehicle type,
-- distinct from "truck" (rigid LKW) and the existing "trailer" (Dorse /
-- Auflieger) category.
alter table watchlists drop constraint if exists watchlists_vehicle_type_check;
alter table watchlists add constraint watchlists_vehicle_type_check
  check (vehicle_type in ('car','van','truck','tractor_unit','trailer','construction','spare_part','bus','other'));

alter table market_listings drop constraint if exists market_listings_vehicle_type_check;
alter table market_listings add constraint market_listings_vehicle_type_check
  check (vehicle_type in ('car','van','truck','tractor_unit','trailer','construction','spare_part','bus','other'));

alter table vehicles drop constraint if exists vehicles_vehicle_type_check;
alter table vehicles add constraint vehicles_vehicle_type_check
  check (vehicle_type in ('car','van','truck','tractor_unit','trailer','construction','spare_part','bus','other'));
