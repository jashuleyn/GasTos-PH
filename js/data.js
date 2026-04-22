// ────────────────────────────────────────────────
// DATA — Updated April 22-28 2026 (DOE weekly)
// NCR prices sourced from GasWatch PH / DOE advisory
// ────────────────────────────────────────────────

const PRICES = {
  ncr: [{t:'RON 95',b:'Shell · Petron · Caltex avg',p:88.10,c:+2.50},{t:'RON 91',b:'Shell · Petron · Seaoil avg',p:84.32,c:+2.10},{t:'RON 97/100',b:'Shell V-Power · Petron Blaze',p:96.50,c:+3.00},{t:'Diesel',b:'Industry average',p:101.78,c:+4.20},{t:'Diesel Plus',b:'Premium diesel avg',p:108.50,c:+4.50},{t:'Kerosene',b:'General average',p:149.89,c:+6.00}],
  r1:  [{t:'RON 95',b:'Petron · Phoenix',p:87.50,c:+2.40},{t:'RON 91',b:'Petron · Seaoil',p:83.70,c:+2.00},{t:'RON 97/100',b:'Shell · Petron',p:95.80,c:+2.90},{t:'Diesel',b:'Industry avg',p:101.10,c:+4.10},{t:'Kerosene',b:'General avg',p:148.90,c:+5.80}],
  r2:  [{t:'RON 95',b:'Petron · Phoenix',p:87.20,c:+2.30},{t:'RON 91',b:'Petron avg',p:83.50,c:+2.00},{t:'RON 97/100',b:'Petron',p:95.50,c:+2.80},{t:'Diesel',b:'Industry avg',p:100.80,c:+4.00},{t:'Kerosene',b:'General avg',p:148.50,c:+5.70}],
  r3:  [{t:'RON 95',b:'Petron · Phoenix',p:87.80,c:+2.50},{t:'RON 91',b:'Petron · Seaoil',p:83.90,c:+2.10},{t:'RON 97/100',b:'Shell · Petron',p:96.00,c:+2.95},{t:'Diesel',b:'Industry avg',p:101.20,c:+4.10},{t:'Kerosene',b:'General avg',p:148.80,c:+5.80}],
  r4a: [{t:'RON 95',b:'Shell · Caltex',p:88.00,c:+2.50},{t:'RON 91',b:'Shell · Seaoil',p:84.20,c:+2.10},{t:'RON 97/100',b:'Shell V-Power',p:96.40,c:+3.00},{t:'Diesel',b:'Industry avg',p:101.60,c:+4.20},{t:'Kerosene',b:'General avg',p:149.50,c:+6.00}],
  r4b: [{t:'RON 95',b:'Petron · Phoenix',p:87.00,c:+2.30},{t:'RON 91',b:'Petron avg',p:83.20,c:+2.00},{t:'RON 97/100',b:'Shell',p:95.30,c:+2.80},{t:'Diesel',b:'Industry avg',p:100.50,c:+4.00},{t:'Kerosene',b:'General avg',p:148.20,c:+5.60}],
  r5:  [{t:'RON 95',b:'Petron · Phoenix',p:86.80,c:+2.30},{t:'RON 91',b:'Petron avg',p:83.00,c:+2.00},{t:'RON 97/100',b:'Shell · Petron',p:95.10,c:+2.80},{t:'Diesel',b:'Industry avg',p:100.30,c:+3.90},{t:'Kerosene',b:'General avg',p:148.00,c:+5.50}],
  r6:  [{t:'RON 95',b:'Petron · Phoenix',p:86.50,c:+2.20},{t:'RON 91',b:'Petron avg',p:82.80,c:+1.90},{t:'RON 97/100',b:'Shell · Petron',p:94.80,c:+2.70},{t:'Diesel',b:'Industry avg',p:100.00,c:+3.80},{t:'Kerosene',b:'General avg',p:147.60,c:+5.40}],
  r7:  [{t:'RON 95',b:'Shell · Caltex',p:86.70,c:+2.30},{t:'RON 91',b:'Shell · Seaoil',p:83.00,c:+2.00},{t:'RON 97/100',b:'Shell',p:95.00,c:+2.80},{t:'Diesel',b:'Industry avg',p:100.20,c:+3.90},{t:'Kerosene',b:'General avg',p:147.80,c:+5.50}],
  r8:  [{t:'RON 95',b:'Petron · Phoenix',p:86.20,c:+2.20},{t:'RON 91',b:'Petron avg',p:82.50,c:+1.90},{t:'RON 97/100',b:'Petron',p:94.50,c:+2.70},{t:'Diesel',b:'Industry avg',p:99.80,c:+3.80},{t:'Kerosene',b:'General avg',p:147.40,c:+5.30}],
  r9:  [{t:'RON 95',b:'Petron · Phoenix',p:85.80,c:+2.10},{t:'RON 91',b:'Petron avg',p:82.10,c:+1.80},{t:'RON 97/100',b:'Petron',p:94.10,c:+2.60},{t:'Diesel',b:'Industry avg',p:99.40,c:+3.70},{t:'Kerosene',b:'General avg',p:147.00,c:+5.20}],
  r10: [{t:'RON 95',b:'Petron · Phoenix',p:86.00,c:+2.20},{t:'RON 91',b:'Petron avg',p:82.30,c:+1.90},{t:'RON 97/100',b:'Petron Blaze',p:94.30,c:+2.70},{t:'Diesel',b:'Industry avg',p:99.60,c:+3.80},{t:'Kerosene',b:'General avg',p:147.20,c:+5.30}],
  r11: [{t:'RON 95',b:'Petron · Phoenix',p:86.10,c:+2.20},{t:'RON 91',b:'Petron avg',p:82.40,c:+1.90},{t:'RON 97/100',b:'Petron Blaze',p:94.40,c:+2.70},{t:'Diesel',b:'Industry avg',p:99.70,c:+3.80},{t:'Kerosene',b:'General avg',p:147.30,c:+5.30}],
  r12: [{t:'RON 95',b:'Petron · Phoenix',p:85.90,c:+2.10},{t:'RON 91',b:'Petron avg',p:82.20,c:+1.80},{t:'RON 97/100',b:'Petron',p:94.20,c:+2.60},{t:'Diesel',b:'Industry avg',p:99.50,c:+3.70},{t:'Kerosene',b:'General avg',p:147.10,c:+5.20}],
  car: [{t:'RON 95',b:'Petron · Phoenix',p:87.00,c:+2.30},{t:'RON 91',b:'Petron avg',p:83.20,c:+2.00},{t:'RON 97/100',b:'Shell',p:95.30,c:+2.80},{t:'Diesel',b:'Industry avg',p:100.50,c:+4.00},{t:'Kerosene',b:'General avg',p:148.20,c:+5.60}],
  caraga: [{t:'RON 95',b:'Petron · Phoenix',p:85.70,c:+2.10},{t:'RON 91',b:'Petron avg',p:82.00,c:+1.80},{t:'RON 97/100',b:'Petron',p:94.00,c:+2.60},{t:'Diesel',b:'Industry avg',p:99.30,c:+3.70},{t:'Kerosene',b:'General avg',p:146.90,c:+5.20}],
  barmm:[{t:'RON 95',b:'Petron · Phoenix',p:85.50,c:+2.10},{t:'RON 91',b:'Petron avg',p:81.80,c:+1.80},{t:'RON 97/100',b:'Petron',p:93.80,c:+2.50},{t:'Diesel',b:'Industry avg',p:99.10,c:+3.60},{t:'Kerosene',b:'General avg',p:146.70,c:+5.10}]
};

const BRANDS = [
  {n:'Shell',tag:'Major',p:{'RON 91':85.21,'RON 95':88.50,'V-Power 97':97.00,'Diesel':102.50}},
  {n:'Petron',tag:'Major',p:{'RON 91':85.86,'RON 95':88.10,'Blaze 100':96.50,'Diesel':101.13}},
  {n:'Caltex',tag:'Major',p:{'RON 91':85.50,'RON 95':88.20,'RON 97':96.80,'Diesel':101.80}},
  {n:'Seaoil',tag:'Independent',p:{'RON 91':84.32,'RON 95':87.80,'RON 97':95.50,'Diesel':101.00}},
  {n:'Phoenix',tag:'Independent',p:{'RON 91':84.50,'RON 95':88.00,'RON 97':95.80,'Diesel':101.30}},
  {n:'Flying V',tag:'Independent',p:{'RON 91':85.00,'RON 95':87.90,'Diesel':100.45}},
  {n:'Cleanfuel',tag:'Budget',p:{'RON 91':83.80,'RON 95':87.40,'Diesel':100.00}},
  {n:'Jetti',tag:'Budget',p:{'RON 91':83.60,'RON 95':87.20,'Diesel':100.20}},
];

const REPORTS = [
  {s:'Shell EDSA Mandaluyong',f:'RON 95',p:88.50,loc:'Mandaluyong',t:'1 hr ago',v:14},
  {s:'Petron Ortigas Ave',f:'Diesel',p:101.13,loc:'Pasig',t:'3 hrs ago',v:9},
  {s:'Cleanfuel SM Novaliches',f:'Diesel',p:100.00,loc:'Quezon City',t:'4 hrs ago',v:22},
  {s:'Seaoil Katipunan Ave',f:'RON 91',p:84.32,loc:'Quezon City',t:'5 hrs ago',v:11},
  {s:'Petron NLEX Bulacan',f:'Diesel',p:102.50,loc:'Bulacan',t:'Yesterday',v:3},
  {s:'Caltex C5 Road Taguig',f:'RON 95',p:88.20,loc:'Taguig',t:'Yesterday',v:7},
];
